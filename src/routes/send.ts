// src/routes/send.ts
import { Hono } from 'hono';
import { Env, Mailbox } from '../types';
import { authMiddleware, AuthContextVariables } from '../middleware/auth';
import { EmailSenderService } from '../services/emailSender';
import { StorageService } from '../services/storage';
import { generateId, currentTimestamp } from '../utils/db';

export const sendRouter = new Hono<{ Bindings: Env; Variables: AuthContextVariables }>();
sendRouter.use('*', authMiddleware);

/**
 * 发送邮件
 */
sendRouter.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const {
      mailboxId,
      fromAddress,
      to,
      cc,
      bcc,
      replyTo,
      subject,
      text,
      html,
      attachments,
    } = body;

    // 1. 验证发件邮箱所有权
    let mailbox: Mailbox | null = null;
    if (mailboxId) {
      mailbox = await c.env.DB.prepare('SELECT * FROM mailboxes WHERE id = ? AND user_id = ? AND is_active = 1')
        .bind(mailboxId, user.id)
        .first<Mailbox>();
    } else if (fromAddress) {
      mailbox = await c.env.DB.prepare('SELECT * FROM mailboxes WHERE LOWER(address) = ? AND user_id = ? AND is_active = 1')
        .bind(fromAddress.toLowerCase(), user.id)
        .first<Mailbox>();
    } else {
      // 默认使用主邮箱
      mailbox = await c.env.DB.prepare('SELECT * FROM mailboxes WHERE user_id = ? AND is_active = 1 ORDER BY is_primary DESC LIMIT 1')
        .bind(user.id)
        .first<Mailbox>();
    }

    if (!mailbox) {
      return c.json({ success: false, error: '未找到合法的发信邮箱地址' }, 400);
    }

    // 2. 校验收件人
    if (!to || !Array.isArray(to) || to.length === 0) {
      return c.json({ success: false, error: '请至少填写一个收件人' }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const addr of to) {
      if (!emailRegex.test(addr.trim())) {
        return c.json({ success: false, error: `无效的收件人邮箱格式: ${addr}` }, 400);
      }
    }

    const cleanTo = to.map((addr: string) => addr.trim());
    const cleanCc = Array.isArray(cc) ? cc.map((addr: string) => addr.trim()).filter((a: string) => emailRegex.test(a)) : [];
    const cleanBcc = Array.isArray(bcc) ? bcc.map((addr: string) => addr.trim()).filter((a: string) => emailRegex.test(a)) : [];

    const mailSubject = (subject || '').trim() || '(无主题)';
    const mailText = text || '';
    const mailHtml = html || (mailText ? `<pre style="font-family: inherit; white-space: pre-wrap;">${mailText}</pre>` : '');

    // 3. 调用发信服务
    const sendResult = await EmailSenderService.send(c.env, {
      userId: user.id,
      fromName: mailbox.name || user.username,
      fromAddress: mailbox.address,
      to: cleanTo,
      cc: cleanCc.length > 0 ? cleanCc : undefined,
      bcc: cleanBcc.length > 0 ? cleanBcc : undefined,
      replyTo: replyTo || mailbox.address,
      subject: mailSubject,
      text: mailText,
      html: mailHtml,
      attachments: attachments && Array.isArray(attachments) ? attachments : undefined,
    });

    if (!sendResult.success) {
      return c.json({ success: false, error: sendResult.error || '邮件投递失败，请检查发信通道设置' }, 502);
    }

    // 4. 将发送的邮件归档保存到用户的已发送 (outbound)
    const emailId = generateId();
    const now = currentTimestamp();
    const snippet = (mailText || mailSubject).slice(0, 150).replace(/\s+/g, ' ').trim();
    const toObjects = cleanTo.map(addr => ({ name: '', address: addr }));
    const ccObjects = cleanCc.map(addr => ({ name: '', address: addr }));
    const bccObjects = cleanBcc.map(addr => ({ name: '', address: addr }));

    const rawSize = mailHtml.length + mailText.length;

    await c.env.DB.prepare(`
      INSERT INTO emails (
        id, mailbox_id, user_id, message_id, direction,
        from_name, from_address, to_addresses, cc_addresses, bcc_addresses,
        reply_to, subject, snippet, body_text, body_html, raw_size,
        is_read, is_starred, is_trash, is_spam, created_at
      ) VALUES (
        ?, ?, ?, ?, 'outbound',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        1, 0, 0, 0, ?
      )
    `)
      .bind(
        emailId,
        mailbox.id,
        user.id,
        sendResult.messageId || null,
        mailbox.name || user.username,
        mailbox.address,
        JSON.stringify(toObjects),
        ccObjects.length > 0 ? JSON.stringify(ccObjects) : null,
        bccObjects.length > 0 ? JSON.stringify(bccObjects) : null,
        replyTo || null,
        mailSubject,
        snippet,
        mailText,
        mailHtml,
        rawSize,
        now
      )
      .run();

    // 5. 保存已发邮件附件（若有）
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.filename && att.content) {
          // 处理 Base64 解码存储
          const binaryStr = atob(att.content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          await StorageService.saveAttachment(c.env, {
            emailId,
            filename: att.filename,
            contentType: att.contentType || 'application/octet-stream',
            size: bytes.byteLength,
            data: bytes,
          });
        }
      }
    }

    return c.json({
      success: true,
      message: '邮件发送成功',
      data: {
        emailId,
        messageId: sendResult.messageId,
      },
    });
  } catch (error) {
    console.error('Send email error:', error);
    return c.json({ success: false, error: '发信服务异常' }, 500);
  }
});
