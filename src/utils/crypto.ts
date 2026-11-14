// src/utils/crypto.ts
// 使用 Web Crypto API 实现安全、免第三方原生依赖的密码哈希与 JWT 鉴权

/**
 * 生成随机 Salt
 */
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 密码哈希 (PBKDF2-HMAC-SHA256)
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 校验密码
 */
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

/**
 * Base64 URL 编解码
 */
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * 生成签名密钥 (HMAC-SHA256)
 */
async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * 签发 JWT
 */
export async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${data}.${encodedSignature}`;
}

/**
 * 验证并解析 JWT
 */
export async function verifyJWT<T = Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const key = await getCryptoKey(secret);
    const signatureStr = base64UrlDecode(signatureB64);
    const signatureBytes = new Uint8Array(signatureStr.split('').map(c => c.charCodeAt(0)));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(data)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as T & { exp?: number };
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Token 过期
    }

    return payload;
  } catch {
    return null;
  }
}
