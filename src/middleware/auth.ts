// src/middleware/auth.ts
import { Context, Next } from 'hono';
import { Env, AuthPayload, User } from '../types';
import { verifyJWT } from '../utils/crypto';

export interface AuthContextVariables {
  user: {
    id: string;
    username: string;
    role: 'admin' | 'user';
  };
}

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: AuthContextVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未授权，请先登录' }, 401);
  }

  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET || 'cfmail_super_secret_jwt_key_2026';
  const payload = await verifyJWT<AuthPayload>(token, secret);

  if (!payload || !payload.userId) {
    return c.json({ success: false, error: '登录会话已失效或过期，请重新登录' }, 401);
  }

  // 验证用户在数据库中的状态
  const user = await c.env.DB.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?')
    .bind(payload.userId)
    .first<Pick<User, 'id' | 'username' | 'role' | 'is_active'>>();

  if (!user || user.is_active !== 1) {
    return c.json({ success: false, error: '用户不存在或已被禁用' }, 403);
  }

  c.set('user', {
    id: user.id,
    username: user.username,
    role: user.role,
  });

  await next();
}

export async function adminMiddleware(c: Context<{ Bindings: Env; Variables: AuthContextVariables }>, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ success: false, error: '权限不足，仅管理员可访问' }, 403);
  }

  await next();
}
