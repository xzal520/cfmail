// src/email.ts
import PostalMime from 'postal-mime';
import { Env, Mailbox, User } from './types';
import { generateId, currentTimestamp } from './utils/db';
import { StorageService } from './services/storage';

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

export async function handleEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  try {
    const recipient = message.to.toLowerCase().trim();
    const sender = message.from.trim();

    // 1. 查询收件邮箱是否在数据库中
    let mailbox = await env.DB.prepare(`
      SELECT m.*, u.is_active as user_active, u.quota_bytes, u.used_bytes 
      FROM mailboxes m
      JOIN users u ON m.user_id = u.id
      WHERE LOWER(m.address) = ? AND m.is_active = 1 AND u.is_active = 1
    `)
      .bind(recipient)
      .first<Mailbox & { user_active: number; quota_bytes: number; used_bytes: number }>();

    // 2. 如果未找到精准匹配，尝试匹配域名下的 Catch-all 规则（如管理员主邮箱）
    if (!mailbox) {
      const domainPart = recipient.split('@')[1];
      const adminMailbox = await env.DB.prepare(`
        SELECT m.*, u.is_active as user_active, u.quota_bytes, u.used_bytes
        FROM mailboxes m
        JOIN users u ON m.user_id = u.id
        WHERE u.role = 'admin' AND u.is_active = 1 AND m.is_active = 1
        ORDER BY m.is_primary DESC
        LIMIT 1
      `).first<Mailbox & { user_active: number; quota_bytes: number; used_bytes: number }>();

      if (adminMailbox) {
        mailbox = adminMailbox;
      } else {
        console.warn(`[Email Routing] No active mailbox found for recipient: ${recipient}`);
        return;
      }
    }

    // 3. 检查用户配额
    if (mailbox.used_bytes + message.rawSize > mailbox.quota_bytes) {
      console.warn(`[Email Routing] Mailbox quota exceeded for user ${mailbox.user_id}`);
      // 超出配额暂不拒收，标记或截断附件，保证重要通知不丢失
    }

    // 4. 解析原始 MIME 邮件流
    const rawArrayBuffer = await new Response(message.raw).arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(rawArrayBuffer);

    const emailId = generateId();
    const now = currentTimestamp();

    // 提取主题、正文和摘要
    const subject = parsed.subject || '(无主题)';
    const bodyText = parsed.text || '';
    const bodyHtml = parsed.html || (bodyText ? `<pre style="font-family: inherit; white-space: pre-wrap;">${bodyText}</pre>` : '');
    const snippet = (bodyText || subject).slice(0, 150).replace(/\s+/g, ' ').trim();

    // 整理收发件人信息
    const fromName = parsed.from?.name || '';
    const fromAddress = parsed.from?.address || sender;

    const toAddresses = (parsed.to && parsed.to.length > 0)
      ? parsed.to.map(t => ({ name: t.name || '', address: t.address || '' }))
      : [{ name: '', address: recipient }];

    const ccAddresses = parsed.cc ? parsed.cc.map(c => ({ name: c.name || '', address: c.address || '' })) : [];
    const bccAddresses = parsed.bcc ? parsed.bcc.map(b => ({ name: b.name || '', address: b.address || '' })) : [];

    // 5. 存入 emails 表
    await env.DB.prepare(`
      INSERT INTO emails (
        id, mailbox_id, user_id, message_id, direction,
        from_name, from_address, to_addresses, cc_addresses, bcc_addresses,
        reply_to, subject, snippet, body_text, body_html, raw_size,
        is_read, is_starred, is_trash, is_spam, created_at
      ) VALUES (
        ?, ?, ?, ?, 'inbound',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        0, 0, 0, 0, ?
      )
    `)
      .bind(
        emailId,
        mailbox.id,
        mailbox.user_id,
        parsed.messageId || null,
        fromName,
        fromAddress,
        JSON.stringify(toAddresses),
        ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
        bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
        parsed.replyTo && parsed.replyTo.length > 0 ? parsed.replyTo[0].address : null,
        subject,
        snippet,
        bodyText,
        bodyHtml,
        message.rawSize,
        now
      )
      .run();

    // 6. 保存邮件附件（若有）
    let totalAttachmentSize = 0;
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        let contentBytes: ArrayBuffer | Uint8Array = new Uint8Array(0);
        if (typeof att.content === 'string') {
          contentBytes = new TextEncoder().encode(att.content);
        } else if (att.content) {
          contentBytes = att.content;
        }

        const attSize = contentBytes.byteLength;
        totalAttachmentSize += attSize;

        await StorageService.saveAttachment(env, {
          emailId,
          filename: att.filename || 'attachment.dat',
          contentType: att.mimeType || 'application/octet-stream',
          size: attSize,
          data: contentBytes,
        });
      }
    }

    // 7. 更新用户已用存储空间
    const addedBytes = message.rawSize + totalAttachmentSize;
    await env.DB.prepare(`
      UPDATE users 
      SET used_bytes = used_bytes + ?, updated_at = ? 
      WHERE id = ?
    `)
      .bind(addedBytes, now, mailbox.user_id)
      .run();

    console.log(`[Email Routing] Successfully saved email ${emailId} for mailbox ${mailbox.address}`);
  } catch (error) {
    console.error('[Email Routing] Failed to process incoming email:', error);
  }
}
