// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { handleEmail } from './email';
import { authRouter } from './routes/auth';
import { mailboxRouter } from './routes/mailboxes';
import { emailRouter } from './routes/emails';
import { sendRouter } from './routes/send';
import { adminRouter } from './routes/admin';

const app = new Hono<{ Bindings: Env }>();

// 1. 全局跨域与安全配置
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'Content-Disposition'],
  maxAge: 86400,
}));

// 2. 健康检查接口
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

// 2.1 邮件外部图片加速与防盗链代理接口 (Image Proxy)
app.get('/api/proxy-image', async (c) => {
  const targetUrl = c.req.query('url');
  if (!targetUrl) return c.text('Missing url parameter', 400);

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return c.text('Invalid protocol', 400);
    }

    // 防 SSRF：禁止访问私有内网地址
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return c.text('Forbidden destination', 403);
    }

    const imageRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!imageRes.ok) {
      return c.text(`Image fetch failed with status: ${imageRes.status}`, 502);
    }

    const contentType = imageRes.headers.get('content-type') || 'image/png';
    const body = await imageRes.arrayBuffer();

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: unknown) {
    return c.text(err instanceof Error ? err.message : 'Image proxy error', 500);
  }
});

// 3. 挂载业务路由
app.route('/api/auth', authRouter);
app.route('/api/mailboxes', mailboxRouter);
app.route('/api/emails', emailRouter);
app.route('/api/send', sendRouter);
app.route('/api/admin', adminRouter);

// 4. 全局未捕获错误兜底
app.onError((err, c) => {
  console.error('[App Error]', err);
  return c.json({
    success: false,
    error: err.message || '服务器内部异常',
  }, 500);
});

// 5. 静态资源与前端 SPA 路由接管
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Cloud Mail API is running. Build frontend into ./frontend/dist for UI.', 200);
});

// 6. 导出 Worker 处理入口：包括 HTTP fetch 和 Email Routing 事件
export default {
  fetch: app.fetch,
  email: handleEmail,
};
