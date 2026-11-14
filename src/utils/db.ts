// src/utils/db.ts
import { Env, SettingRecord } from '../types';

/**
 * 生成 UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 获取当前 UNIX 秒级时间戳
 */
export function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 读取系统配置键值
 */
export async function getSetting(db: D1Database, key: string, defaultValue = ''): Promise<string> {
  const result = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<Pick<SettingRecord, 'value'>>();

  return result ? result.value : defaultValue;
}

/**
 * 批量读取系统配置
 */
export async function getAllSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<SettingRecord>();
  const settings: Record<string, string> = {};
  for (const item of results) {
    settings[item.key] = item.value;
  }
  return settings;
}

/**
 * 保存或更新配置
 */
export async function setSetting(db: D1Database, key: string, value: string, description?: string): Promise<void> {
  await db
    .prepare(`
      INSERT INTO settings (key, value, description, updated_at) 
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .bind(key, value, description || null, currentTimestamp())
    .run();
}
