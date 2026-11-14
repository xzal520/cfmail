// src/routes/mailboxes.ts
import { Hono } from 'hono';
import { Env, Mailbox, Domain } from '../types';
import { generateId, currentTimestamp, getSetting } from '../utils/db';
import { authMiddleware, AuthContextVariables } from '../middleware/auth';

export const mailboxRouter = new Hono<{ Bindings: Env; Variables: AuthContextVariables }>();
mailboxRouter.use('*', authMiddleware);

/**
 * 获取当前用户的邮箱列表
 */
mailboxRouter.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(`
    SELECT m.*, d.domain_name 
    FROM mailboxes m
    LEFT JOIN domains d ON m.domain_id = d.id
    WHERE m.user_id = ? AND m.is_active = 1
    ORDER BY m.is_primary DESC, m.created_at ASC
  `)
    .bind(user.id)
    .all<Mailbox & { domain_name?: string }>();

  return c.json({ success: true, data: results });
});

/**
 * 添加新的邮箱别名
 */
mailboxRouter.post('/', async (c) => {
  try {
    const user = c.get('user');
    const { prefix, domainId, name } = await c.req.json();

    if (!prefix || !domainId) {
      return c.json({ success: false, error: '邮箱前缀和域名不能为空' }, 400);
    }

    const cleanPrefix = prefix.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._-]+$/.test(cleanPrefix)) {
      return c.json({ success: false, error: '邮箱前缀只允许字母、数字、点、下划线及减号' }, 400);
    }

    // 检查用户别名数量上限
    const maxMailboxesStr = await getSetting(c.env.DB, 'max_mailboxes_per_user', '5');
    const maxMailboxes = parseInt(maxMailboxesStr, 10);

    const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM mailboxes WHERE user_id = ?')
      .bind(user.id)
      .first<{ count: number }>();

    if (countResult && countResult.count >= maxMailboxes && user.role !== 'admin') {
      return c.json({ success: false, error: `每个用户最多只允许创建 ${maxMailboxes} 个邮箱别名` }, 403);
    }

    // 校验域名是否存在且激活
    const domain = await c.env.DB.prepare('SELECT id, domain_name FROM domains WHERE id = ? AND is_active = 1')
      .bind(domainId)
      .first<Domain>();

    if (!domain) {
      return c.json({ success: false, error: '所选域名不存在或已停用' }, 400);
    }

    const fullAddress = `${cleanPrefix}@${domain.domain_name}`.toLowerCase();

    // 检查地址是否已存在
    const existing = await c.env.DB.prepare('SELECT id FROM mailboxes WHERE LOWER(address) = ?')
      .bind(fullAddress)
      .first();

    if (existing) {
      return c.json({ success: false, error: `邮箱地址 ${fullAddress} 已被占用` }, 400);
    }

    const newId = generateId();
    const now = currentTimestamp();

    await c.env.DB.prepare(`
      INSERT INTO mailboxes (id, user_id, address, domain_id, name, is_primary, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?)
    `)
      .bind(newId, user.id, fullAddress, domain.id, name || cleanPrefix, now)
      .run();

    return c.json({
      success: true,
      data: {
        id: newId,
        address: fullAddress,
        domain_id: domain.id,
        domain_name: domain.domain_name,
        name: name || cleanPrefix,
        is_primary: 0,
      },
    });
  } catch (error) {
    console.error('Create mailbox error:', error);
    return c.json({ success: false, error: '创建邮箱别名失败' }, 500);
  }
});

/**
 * 设为主邮箱
 */
mailboxRouter.put('/:id/primary', async (c) => {
  const user = c.get('user');
  const mailboxId = c.req.param('id');

  const mailbox = await c.env.DB.prepare('SELECT id FROM mailboxes WHERE id = ? AND user_id = ?')
    .bind(mailboxId, user.id)
    .first();

  if (!mailbox) {
    return c.json({ success: false, error: '邮箱不存在' }, 404);
  }

  // 先把用户其他邮箱取消主邮箱
  await c.env.DB.prepare('UPDATE mailboxes SET is_primary = 0 WHERE user_id = ?')
    .bind(user.id)
    .run();

  // 设置当前为主邮箱
  await c.env.DB.prepare('UPDATE mailboxes SET is_primary = 1 WHERE id = ?')
    .bind(mailboxId)
    .run();

  return c.json({ success: true, message: '已设为主邮箱' });
});

/**
 * 删除别名邮箱
 */
mailboxRouter.delete('/:id', async (c) => {
  const user = c.get('user');
  const mailboxId = c.req.param('id');

  const mailbox = await c.env.DB.prepare('SELECT id, is_primary FROM mailboxes WHERE id = ? AND user_id = ?')
    .bind(mailboxId, user.id)
    .first<Pick<Mailbox, 'id' | 'is_primary'>>();

  if (!mailbox) {
    return c.json({ success: false, error: '邮箱不存在' }, 404);
  }

  if (mailbox.is_primary === 1) {
    return c.json({ success: false, error: '主邮箱不允许直接删除，请先将其他邮箱设为主邮箱' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM mailboxes WHERE id = ?')
    .bind(mailboxId)
    .run();

  return c.json({ success: true, message: '邮箱别名已删除' });
});
