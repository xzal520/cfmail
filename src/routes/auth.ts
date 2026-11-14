// src/routes/auth.ts
import { Hono } from 'hono';
import { Env, User, Domain, Mailbox } from '../types';
import { generateSalt, hashPassword, verifyPassword, signJWT } from '../utils/crypto';
import { generateId, currentTimestamp, getSetting } from '../utils/db';
import { authMiddleware, AuthContextVariables } from '../middleware/auth';

export const authRouter = new Hono<{ Bindings: Env; Variables: AuthContextVariables }>();

/**
 * 注册账号
 */
authRouter.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, domainId, mailboxPrefix, inviteCode } = body;

    if (!username || !password) {
      return c.json({ success: false, error: '用户名和密码不能为空' }, 400);
    }

    if (username.length < 3 || username.length > 30) {
      return c.json({ success: false, error: '用户名长度需在 3 到 30 个字符之间' }, 400);
    }

    if (password.length < 6) {
      return c.json({ success: false, error: '密码长度至少为 6 个字符' }, 400);
    }

    // 检查是否已有用户，如果是系统的第一个用户，直接赋予管理员权限
    const userCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
    const isFirstUser = !userCount || userCount.count === 0;

    // 检查是否开放注册
    const allowReg = await getSetting(c.env.DB, 'allow_registration', 'true');
    if (!isFirstUser && allowReg === 'false') {
      return c.json({ success: false, error: '系统当前未开放自主注册，请联系管理员' }, 403);
    }

    // 检查用户名是否已存在
    const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username.toLowerCase())
      .first();

    if (existingUser) {
      return c.json({ success: false, error: '该用户名已被使用' }, 400);
    }

    // 选择关联域名
    let targetDomain: Domain | null = null;
    if (domainId) {
      targetDomain = await c.env.DB.prepare('SELECT * FROM domains WHERE id = ? AND is_active = 1')
        .bind(domainId)
        .first<Domain>();
    } else {
      // 获取默认域名或第一个激活的域名
      targetDomain = await c.env.DB.prepare('SELECT * FROM domains WHERE is_active = 1 ORDER BY is_default DESC, created_at ASC LIMIT 1')
        .first<Domain>();
    }

    const prefix = (mailboxPrefix || username).trim().toLowerCase();
    // 校验邮箱前缀合法字符
    if (!/^[a-zA-Z0-9._-]+$/.test(prefix)) {
      return c.json({ success: false, error: '邮箱前缀只允许字母、数字、点、下划线及减号' }, 400);
    }

    const domainName = targetDomain ? targetDomain.domain_name : 'localhost';
    const emailAddress = `${prefix}@${domainName}`.toLowerCase();

    // 检查邮箱地址是否已被占用
    const existingMailbox = await c.env.DB.prepare('SELECT id FROM mailboxes WHERE LOWER(address) = ?')
      .bind(emailAddress)
      .first();

    if (existingMailbox) {
      return c.json({ success: false, error: `邮箱地址 ${emailAddress} 已被占用，请更换前缀` }, 400);
    }

    // 角色判断：首个用户 或 邀请码正确 为管理员
    const configuredInviteCode = c.env.ADMIN_INVITE_CODE || 'admin888';
    const isAdmin = isFirstUser || (inviteCode && inviteCode === configuredInviteCode);
    const role = isAdmin ? 'admin' : 'user';

    // 默认配额
    const defaultQuotaMb = await getSetting(c.env.DB, 'default_quota_mb', '500');
    const quotaBytes = parseInt(defaultQuotaMb, 10) * 1024 * 1024;

    const userId = generateId();
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = currentTimestamp();

    // 写入用户表
    await c.env.DB.prepare(`
      INSERT INTO users (id, username, password_hash, salt, role, is_active, quota_bytes, used_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?, ?)
    `)
      .bind(userId, username.toLowerCase(), passwordHash, salt, role, quotaBytes, now, now)
      .run();

    // 写入默认邮箱别名
    const mailboxId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO mailboxes (id, user_id, address, domain_id, name, is_primary, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?)
    `)
      .bind(mailboxId, userId, emailAddress, targetDomain ? targetDomain.id : null, username, now)
      .run();

    // 签发 JWT
    const secret = c.env.JWT_SECRET || 'cfmail_super_secret_jwt_key_2026';
    const token = await signJWT(
      {
        userId,
        username,
        role,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 天
      },
      secret
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          username,
          role,
          primaryAddress: emailAddress,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return c.json({ success: false, error: '注册失败，请稍后重试' }, 500);
  }
});

/**
 * 用户登录
 */
authRouter.post('/login', async (c) => {
  try {
    const { account, password } = await c.req.json();
    if (!account || !password) {
      return c.json({ success: false, error: '账号和密码不能为空' }, 400);
    }

    const cleanAccount = account.trim().toLowerCase();

    // 查找用户（支持用户名或邮箱地址登录）
    let user = await c.env.DB.prepare(`
      SELECT * FROM users WHERE LOWER(username) = ?
    `)
      .bind(cleanAccount)
      .first<User>();

    if (!user) {
      // 尝试匹配邮箱别名
      const mailbox = await c.env.DB.prepare(`
        SELECT user_id FROM mailboxes WHERE LOWER(address) = ?
      `)
        .bind(cleanAccount)
        .first<{ user_id: string }>();

      if (mailbox) {
        user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
          .bind(mailbox.user_id)
          .first<User>();
      }
    }

    if (!user) {
      return c.json({ success: false, error: '账号或密码错误' }, 401);
    }

    if (user.is_active !== 1) {
      return c.json({ success: false, error: '该账号已被禁用，请联系管理员' }, 403);
    }

    // 校验密码
    const isValid = await verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return c.json({ success: false, error: '账号或密码错误' }, 401);
    }

    // 获取用户主邮箱
    const primaryBox = await c.env.DB.prepare(`
      SELECT address FROM mailboxes WHERE user_id = ? ORDER BY is_primary DESC LIMIT 1
    `)
      .bind(user.id)
      .first<{ address: string }>();

    // 签发 JWT
    const secret = c.env.JWT_SECRET || 'cfmail_super_secret_jwt_key_2026';
    const token = await signJWT(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      },
      secret
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          primaryAddress: primaryBox ? primaryBox.address : '',
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, error: '登录失败，请稍后重试' }, 500);
  }
});

/**
 * 获取当前登录用户信息
 */
authRouter.get('/me', authMiddleware, async (c) => {
  const authUser = c.get('user');
  const user = await c.env.DB.prepare(`
    SELECT id, username, role, is_active, quota_bytes, used_bytes, created_at 
    FROM users WHERE id = ?
  `)
    .bind(authUser.id)
    .first<Omit<User, 'password_hash' | 'salt'>>();

  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const { results: mailboxes } = await c.env.DB.prepare(`
    SELECT id, address, name, is_primary, created_at 
    FROM mailboxes WHERE user_id = ? AND is_active = 1
    ORDER BY is_primary DESC, created_at ASC
  `)
    .bind(user.id)
    .all<Mailbox>();

  return c.json({
    success: true,
    data: {
      ...user,
      mailboxes,
    },
  });
});

/**
 * 修改个人密码
 */
authRouter.put('/password', authMiddleware, async (c) => {
  const authUser = c.get('user');
  const { oldPassword, newPassword } = await c.req.json();

  if (!oldPassword || !newPassword) {
    return c.json({ success: false, error: '原密码和新密码不能为空' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ success: false, error: '新密码长度至少为 6 个字符' }, 400);
  }

  const user = await c.env.DB.prepare('SELECT password_hash, salt FROM users WHERE id = ?')
    .bind(authUser.id)
    .first<{ password_hash: string; salt: string }>();

  if (!user) {
    return c.json({ success: false, error: '用户不存在' }, 404);
  }

  const isOldValid = await verifyPassword(oldPassword, user.password_hash, user.salt);
  if (!isOldValid) {
    return c.json({ success: false, error: '原密码不正确' }, 400);
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);

  await c.env.DB.prepare(`
    UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?
  `)
    .bind(newHash, newSalt, currentTimestamp(), authUser.id)
    .run();

  return c.json({ success: true, message: '密码修改成功' });
});

/**
 * 公开获取可用于注册的域名列表
 */
authRouter.get('/public-domains', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT id, domain_name, is_default, description 
    FROM domains WHERE is_active = 1 
    ORDER BY is_default DESC, created_at ASC
  `).all<Domain>();

  return c.json({ success: true, data: results });
});
