// src/routes/emails.ts
import { Hono } from 'hono';
import { Env, EmailRecord, AttachmentRecord } from '../types';
import { authMiddleware, AuthContextVariables } from '../middleware/auth';
import { StorageService } from '../services/storage';
import { currentTimestamp } from '../utils/db';

export const emailRouter = new Hono<{ Bindings: Env; Variables: AuthContextVariables }>();
emailRouter.use('*', authMiddleware);

/**
 * 获取文件夹统计信息（未读数等）
 */
emailRouter.get('/stats', async (c) => {
  const user = c.get('user');

  const inboxUnread = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND direction = 'inbound' AND is_trash = 0 AND is_read = 0
  `).bind(user.id).first<{ count: number }>();

  const inboxTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND direction = 'inbound' AND is_trash = 0
  `).bind(user.id).first<{ count: number }>();

  const sentTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND direction = 'outbound' AND is_trash = 0
  `).bind(user.id).first<{ count: number }>();

  const starredTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND is_starred = 1 AND is_trash = 0
  `).bind(user.id).first<{ count: number }>();

  const trashTotal = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails 
    WHERE user_id = ? AND is_trash = 1
  `).bind(user.id).first<{ count: number }>();

  return c.json({
    success: true,
    data: {
      inboxUnread: inboxUnread?.count || 0,
      inboxTotal: inboxTotal?.count || 0,
      sentTotal: sentTotal?.count || 0,
      starredTotal: starredTotal?.count || 0,
      trashTotal: trashTotal?.count || 0,
    },
  });
});

/**
 * 获取邮件列表
 */
emailRouter.get('/', async (c) => {
  const user = c.get('user');
  const folder = c.req.query('folder') || 'inbox'; // 'inbox' | 'sent' | 'starred' | 'trash'
  const mailboxId = c.req.query('mailbox_id');
  const search = c.req.query('search')?.trim();
  const unreadOnly = c.req.query('unread') === 'true';
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['e.user_id = ?'];
  let params: unknown[] = [user.id];

  if (mailboxId) {
    whereClauses.push('e.mailbox_id = ?');
    params.push(mailboxId);
  }

  // 文件夹逻辑
  if (folder === 'trash') {
    whereClauses.push('e.is_trash = 1');
  } else {
    whereClauses.push('e.is_trash = 0');
    if (folder === 'starred') {
      whereClauses.push('e.is_starred = 1');
    } else if (folder === 'sent') {
      whereClauses.push("e.direction = 'outbound'");
    } else {
      // 默认 inbox
      whereClauses.push("e.direction = 'inbound'");
    }
  }

  if (unreadOnly) {
    whereClauses.push('e.is_read = 0');
  }

  if (search) {
    whereClauses.push('(e.subject LIKE ? OR e.from_address LIKE ? OR e.snippet LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = whereClauses.join(' AND ');

  // 查询总数
  const totalCountResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM emails e WHERE ${whereSql}
  `)
    .bind(...params)
    .first<{ count: number }>();

  const total = totalCountResult?.count || 0;

  // 查询列表（包含附件数量标记）
  const querySql = `
    SELECT 
      e.id, e.mailbox_id, e.direction, e.from_name, e.from_address,
      e.to_addresses, e.subject, e.snippet, e.is_read, e.is_starred,
      e.is_trash, e.created_at, e.raw_size,
      m.address as mailbox_address,
      (SELECT COUNT(*) FROM attachments a WHERE a.email_id = e.id) as attachment_count
    FROM emails e
    LEFT JOIN mailboxes m ON e.mailbox_id = m.id
    WHERE ${whereSql}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const { results } = await c.env.DB.prepare(querySql)
    .bind(...params, limit, offset)
    .all();

  return c.json({
    success: true,
    data: {
      items: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * 获取邮件详情
 */
emailRouter.get('/:id', async (c) => {
  const user = c.get('user');
  const emailId = c.req.param('id');

  const email = await c.env.DB.prepare(`
    SELECT e.*, m.address as mailbox_address
    FROM emails e
    LEFT JOIN mailboxes m ON e.mailbox_id = m.id
    WHERE e.id = ? AND e.user_id = ?
  `)
    .bind(emailId, user.id)
    .first<EmailRecord & { mailbox_address?: string }>();

  if (!email) {
    return c.json({ success: false, error: '邮件不存在' }, 404);
  }

  // 自动标记为已读
  if (email.is_read === 0) {
    await c.env.DB.prepare('UPDATE emails SET is_read = 1 WHERE id = ?')
      .bind(emailId)
      .run();
    email.is_read = 1;
  }

  // 获取附件列表
  const { results: attachments } = await c.env.DB.prepare(`
    SELECT id, filename, content_type, size, created_at 
    FROM attachments WHERE email_id = ?
  `)
    .bind(emailId)
    .all<Omit<AttachmentRecord, 'data_blob'>>();

  return c.json({
    success: true,
    data: {
      ...email,
      to_addresses: JSON.parse(email.to_addresses || '[]'),
      cc_addresses: email.cc_addresses ? JSON.parse(email.cc_addresses) : [],
      bcc_addresses: email.bcc_addresses ? JSON.parse(email.bcc_addresses) : [],
      attachments,
    },
  });
});

/**
 * 切换/设置已读状态
 */
emailRouter.patch('/:id/read', async (c) => {
  const user = c.get('user');
  const emailId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const isRead = typeof body.is_read === 'boolean' ? (body.is_read ? 1 : 0) : null;

  if (isRead !== null) {
    await c.env.DB.prepare('UPDATE emails SET is_read = ? WHERE id = ? AND user_id = ?')
      .bind(isRead, emailId, user.id)
      .run();
  } else {
    // 切换
    await c.env.DB.prepare('UPDATE emails SET is_read = 1 - is_read WHERE id = ? AND user_id = ?')
      .bind(emailId, user.id)
      .run();
  }

  return c.json({ success: true });
});

/**
 * 切换星标
 */
emailRouter.patch('/:id/star', async (c) => {
  const user = c.get('user');
  const emailId = c.req.param('id');

  await c.env.DB.prepare('UPDATE emails SET is_starred = 1 - is_starred WHERE id = ? AND user_id = ?')
    .bind(emailId, user.id)
    .run();

  return c.json({ success: true });
});

/**
 * 删除邮件：移入垃圾箱，若已在垃圾箱则彻底删除并释放空间
 */
emailRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const emailId = c.req.param('id');

  const email = await c.env.DB.prepare('SELECT id, is_trash, raw_size FROM emails WHERE id = ? AND user_id = ?')
    .bind(emailId, user.id)
    .first<Pick<EmailRecord, 'id' | 'is_trash' | 'raw_size'>>();

  if (!email) {
    return c.json({ success: false, error: '邮件不存在' }, 404);
  }

  if (email.is_trash === 0) {
    // 移入垃圾箱
    await c.env.DB.prepare('UPDATE emails SET is_trash = 1 WHERE id = ?')
      .bind(emailId)
      .run();
    return c.json({ success: true, message: '邮件已移入垃圾箱' });
  } else {
    // 彻底删除
    // 1. 删除附件并计算释放空间
    const { results: atts } = await c.env.DB.prepare('SELECT size FROM attachments WHERE email_id = ?')
      .bind(emailId)
      .all<{ size: number }>();

    const totalAttSize = atts.reduce((sum, item) => sum + item.size, 0);
    const freedBytes = email.raw_size + totalAttSize;

    await StorageService.deleteEmailAttachments(c.env, emailId);

    // 2. 删除邮件记录
    await c.env.DB.prepare('DELETE FROM emails WHERE id = ?')
      .bind(emailId)
      .run();

    // 3. 扣减已用存储
    await c.env.DB.prepare(`
      UPDATE users 
      SET used_bytes = MAX(0, used_bytes - ?), updated_at = ? 
      WHERE id = ?
    `)
      .bind(freedBytes, currentTimestamp(), user.id)
      .run();

    return c.json({ success: true, message: '邮件已彻底删除' });
  }
});

/**
 * 从垃圾箱还原邮件
 */
emailRouter.post('/:id/restore', async (c) => {
  const user = c.get('user');
  const emailId = c.req.param('id');

  await c.env.DB.prepare('UPDATE emails SET is_trash = 0 WHERE id = ? AND user_id = ?')
    .bind(emailId, user.id)
    .run();

  return c.json({ success: true, message: '邮件已恢复' });
});

/**
 * 下载附件
 */
emailRouter.get('/:id/attachments/:attachmentId', async (c) => {
  const user = c.get('user');
  const emailId = c.req.param('id');
  const attachmentId = c.req.param('attachmentId');

  // 验证邮件归属权
  const email = await c.env.DB.prepare('SELECT id FROM emails WHERE id = ? AND user_id = ?')
    .bind(emailId, user.id)
    .first();

  if (!email) {
    return c.json({ success: false, error: '无权访问该附件' }, 403);
  }

  const att = await StorageService.getAttachment(c.env, attachmentId);
  if (!att) {
    return c.json({ success: false, error: '附件不存在或已被清理' }, 404);
  }

  const encodedFilename = encodeURIComponent(att.filename);
  return new Response(att.data as BodyInit, {
    headers: {
      'Content-Type': att.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
    },
  });
});
