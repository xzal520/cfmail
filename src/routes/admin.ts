// src/routes/admin.ts
import { Hono } from 'hono';
import { Env, Domain, User, SettingRecord, SendLogRecord } from '../types';
import { authMiddleware, adminMiddleware, AuthContextVariables } from '../middleware/auth';
import { generateId, currentTimestamp, setSetting } from '../utils/db';
import { generateSalt, hashPassword } from '../utils/crypto';
import { EmailSenderService } from '../services/emailSender';

export const adminRouter = new Hono<{ Bindings: Env; Variables: AuthContextVariables }>();
adminRouter.use('*', authMiddleware, adminMiddleware);

/**
 * 仪表板总览统计
 */
adminRouter.get('/overview', async (c) => {
  // 总用户数
  const usersCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
  // 域名数
  const domainsCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM domains').first<{ count: number }>();
  // 邮箱地址总数
  const mailboxesCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM mailboxes').first<{ count: number }>();
  // 邮件总数
  const emailsCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM emails').first<{ count: number }>();
  // 今日邮件数
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const todayEmailsCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM emails WHERE created_at >= ?')
    .bind(startOfDay)
    .first<{ count: number }>();
  // 系统已用存储空间
  const storageUsed = await c.env.DB.prepare('SELECT SUM(used_bytes) as total FROM users').first<{ total: number }>();

  return c.json({
    success: true,
    data: {
      totalUsers: usersCount?.count || 0,
      totalDomains: domainsCount?.count || 0,
      totalMailboxes: mailboxesCount?.count || 0,
      totalEmails: emailsCount?.count || 0,
      todayEmails: todayEmailsCount?.count || 0,
      totalStorageBytes: storageUsed?.total || 0,
    },
  });
});

/**
 * 域名列表
 */
adminRouter.get('/domains', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT d.*, 
      (SELECT COUNT(*) FROM mailboxes m WHERE m.domain_id = d.id) as mailbox_count
    FROM domains d
    ORDER BY d.is_default DESC, d.created_at ASC
  `).all();

  return c.json({ success: true, data: results });
});

/**
 * 添加域名
 */
adminRouter.post('/domains', async (c) => {
  const { domainName, description, isDefault } = await c.req.json();
  if (!domainName) {
    return c.json({ success: false, error: '域名不能为空' }, 400);
  }

  const cleanDomain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain)) {
    return c.json({ success: false, error: '域名格式不正确' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM domains WHERE domain_name = ?')
    .bind(cleanDomain)
    .first();

  if (existing) {
    return c.json({ success: false, error: '该域名已存在' }, 400);
  }

  const domainId = generateId();
  const now = currentTimestamp();

  if (isDefault) {
    await c.env.DB.prepare('UPDATE domains SET is_default = 0').run();
  }

  await c.env.DB.prepare(`
    INSERT INTO domains (id, domain_name, is_active, is_default, description, created_at)
    VALUES (?, ?, 1, ?, ?, ?)
  `)
    .bind(domainId, cleanDomain, isDefault ? 1 : 0, description || null, now)
    .run();

  return c.json({
    success: true,
    data: { id: domainId, domain_name: cleanDomain },
  });
});

/**
 * 更新域名（启用/禁用，设为默认）
 */
adminRouter.put('/domains/:id', async (c) => {
  const domainId = c.req.param('id');
  const { isActive, isDefault, description } = await c.req.json();

  if (isDefault) {
    await c.env.DB.prepare('UPDATE domains SET is_default = 0').run();
  }

  await c.env.DB.prepare(`
    UPDATE domains 
    SET is_active = COALESCE(?, is_active),
        is_default = COALESCE(?, is_default),
        description = COALESCE(?, description)
    WHERE id = ?
  `)
    .bind(
      typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null,
      typeof isDefault === 'boolean' ? (isDefault ? 1 : 0) : null,
      description !== undefined ? description : null,
      domainId
    )
    .run();

  return c.json({ success: true, message: '域名配置已更新' });
});

/**
 * 删除域名
 */
adminRouter.delete('/domains/:id', async (c) => {
  const domainId = c.req.param('id');

  // 检查是否有关联邮箱
  const mailboxCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM mailboxes WHERE domain_id = ?')
    .bind(domainId)
    .first<{ count: number }>();

  if (mailboxCount && mailboxCount.count > 0) {
    return c.json({ success: false, error: `该域名下仍有 ${mailboxCount.count} 个邮箱别名，无法直接删除` }, 400);
  }

  await c.env.DB.prepare('DELETE FROM domains WHERE id = ?').bind(domainId).run();
  return c.json({ success: true, message: '域名已删除' });
});

/**
 * 获取域名的 Cloudflare DNS 指南记录
 */
adminRouter.get('/domains/:id/dns', async (c) => {
  const domainId = c.req.param('id');
  const domain = await c.env.DB.prepare('SELECT * FROM domains WHERE id = ?')
    .bind(domainId)
    .first<Domain>();

  if (!domain) {
    return c.json({ success: false, error: '域名不存在' }, 404);
  }

  const d = domain.domain_name;
  const records = [
    {
      type: 'MX',
      name: '@',
      value: 'isaac.mx.cloudflare.net',
      priority: 13,
      purpose: 'Cloudflare Email Routing 收信路由解析 1',
    },
    {
      type: 'MX',
      name: '@',
      value: 'linda.mx.cloudflare.net',
      priority: 56,
      purpose: 'Cloudflare Email Routing 收信路由解析 2',
    },
    {
      type: 'MX',
      name: '@',
      value: 'amir.mx.cloudflare.net',
      priority: 91,
      purpose: 'Cloudflare Email Routing 收信路由解析 3',
    },
    {
      type: 'TXT',
      name: '@',
      value: 'v=spf1 include:_spf.mx.cloudflare.net include:resend.com ~all',
      purpose: 'SPF 发信防伪认证 (授权 Cloudflare & Resend 发信)',
    },
    {
      type: 'TXT',
      name: '_dmarc',
      value: `v=DMARC1; p=none; rua=mailto:dmarc-reports@${d}`,
      purpose: 'DMARC 邮件策略与防伪造投递保护',
    },
    {
      type: 'TXT / CNAME',
      name: `resend._domainkey.${d}`,
      value: '可在 Resend 控制台添加域名后获取对应的 DKIM 密钥记录',
      purpose: 'DKIM 数字签名防篡改 (高送达率必需)',
    },
  ];

  return c.json({
    success: true,
    data: {
      domain: d,
      records,
    },
  });
});

/**
 * 用户列表
 */
adminRouter.get('/users', async (c) => {
  const search = c.req.query('search')?.trim();
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
  const offset = (page - 1) * limit;

  let whereSql = '';
  const params: unknown[] = [];

  if (search) {
    whereSql = 'WHERE u.username LIKE ?';
    params.push(`%${search}%`);
  }

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM users u ${whereSql}`)
    .bind(...params)
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  const { results } = await c.env.DB.prepare(`
    SELECT 
      u.id, u.username, u.role, u.is_active, u.quota_bytes, u.used_bytes, u.created_at, u.updated_at,
      (SELECT address FROM mailboxes WHERE user_id = u.id AND is_primary = 1 LIMIT 1) as primary_email,
      (SELECT COUNT(*) FROM mailboxes WHERE user_id = u.id) as mailbox_count,
      (SELECT COUNT(*) FROM emails WHERE user_id = u.id) as email_count
    FROM users u
    ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `)
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
 * 切换用户状态（启用/禁用）
 */
adminRouter.patch('/users/:id/status', async (c) => {
  const admin = c.get('user');
  const targetId = c.req.param('id');
  const { isActive } = await c.req.json();

  if (admin.id === targetId) {
    return c.json({ success: false, error: '不能禁用自己的账号' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?')
    .bind(isActive ? 1 : 0, currentTimestamp(), targetId)
    .run();

  return c.json({ success: true, message: isActive ? '用户已启用' : '用户已禁用' });
});

/**
 * 切换用户角色（用户/管理员）
 */
adminRouter.patch('/users/:id/role', async (c) => {
  const admin = c.get('user');
  const targetId = c.req.param('id');
  const { role } = await c.req.json();

  if (admin.id === targetId) {
    return c.json({ success: false, error: '不能修改自己的管理员权限' }, 400);
  }

  if (role !== 'admin' && role !== 'user') {
    return c.json({ success: false, error: '角色参数错误' }, 400);
  }

  await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .bind(role, currentTimestamp(), targetId)
    .run();

  return c.json({ success: true, message: '角色已更新' });
});

/**
 * 修改用户空间配额
 */
adminRouter.put('/users/:id/quota', async (c) => {
  const targetId = c.req.param('id');
  const { quotaMb } = await c.req.json();

  const mb = parseInt(quotaMb, 10);
  if (isNaN(mb) || mb < 10) {
    return c.json({ success: false, error: '配额大小需至少为 10MB' }, 400);
  }

  const quotaBytes = mb * 1024 * 1024;
  await c.env.DB.prepare('UPDATE users SET quota_bytes = ?, updated_at = ? WHERE id = ?')
    .bind(quotaBytes, currentTimestamp(), targetId)
    .run();

  return c.json({ success: true, message: '配额已调整' });
});

/**
 * 重置用户密码
 */
adminRouter.post('/users/:id/reset-password', async (c) => {
  const targetId = c.req.param('id');
  const { newPassword } = await c.req.json();

  if (!newPassword || newPassword.length < 6) {
    return c.json({ success: false, error: '新密码至少需 6 个字符' }, 400);
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  await c.env.DB.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?')
    .bind(newHash, newSalt, currentTimestamp(), targetId)
    .run();

  return c.json({ success: true, message: '密码已重置' });
});

/**
 * 删除用户
 */
adminRouter.delete('/users/:id', async (c) => {
  const admin = c.get('user');
  const targetId = c.req.param('id');

  if (admin.id === targetId) {
    return c.json({ success: false, error: '不能删除自己的账号' }, 400);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(targetId).run();
  return c.json({ success: true, message: '用户已彻底删除' });
});

/**
 * 获取全局系统设置
 */
adminRouter.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT key, value, description FROM settings').all<SettingRecord>();
  const settings: Record<string, string> = {};
  for (const item of results) {
    settings[item.key] = item.value;
  }
  return c.json({ success: true, data: settings });
});

/**
 * 更新全局系统设置
 */
adminRouter.put('/settings', async (c) => {
  const body = await c.req.json();
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      await setSetting(c.env.DB, key, String(val));
    }
  }
  return c.json({ success: true, message: '系统设置已保存' });
});

/**
 * 测试发信
 */
adminRouter.post('/test-send', async (c) => {
  const { targetEmail } = await c.req.json();
  if (!targetEmail) {
    return c.json({ success: false, error: '目标测试邮箱不能为空' }, 400);
  }

  const result = await EmailSenderService.testConnection(c.env, targetEmail);
  return c.json(result);
});

/**
 * 查看最近发信审计日志
 */
adminRouter.get('/logs', async (c) => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
  const { results } = await c.env.DB.prepare(`
    SELECT l.*, u.username 
    FROM send_logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
    LIMIT ?
  `)
    .bind(limit)
    .all<SendLogRecord & { username?: string }>();

  return c.json({ success: true, data: results });
});
