// src/services/storage.ts
import { Env, AttachmentRecord } from '../types';
import { generateId, currentTimestamp } from '../utils/db';

export interface SaveAttachmentInput {
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  data: ArrayBuffer | Uint8Array;
}

export class StorageService {
  /**
   * 保存附件（优先存入 R2，无 R2 则存入 D1 BLOB）
   */
  static async saveAttachment(env: Env, input: SaveAttachmentInput): Promise<string> {
    const attachmentId = generateId();
    const now = currentTimestamp();

    if (env.STORAGE) {
      // 使用 R2 存储
      const storageKey = `attachments/${input.emailId}/${attachmentId}-${input.filename}`;
      await env.STORAGE.put(storageKey, input.data, {
        httpMetadata: {
          contentType: input.contentType,
        },
      });

      await env.DB.prepare(`
        INSERT INTO attachments (id, email_id, filename, content_type, size, storage_type, storage_key, created_at)
        VALUES (?, ?, ?, ?, ?, 'r2', ?, ?)
      `)
        .bind(attachmentId, input.emailId, input.filename, input.contentType, input.size, storageKey, now)
        .run();
    } else {
      // 降级使用 D1 BLOB 存储（简单独立，免额外付费）
      await env.DB.prepare(`
        INSERT INTO attachments (id, email_id, filename, content_type, size, storage_type, data_blob, created_at)
        VALUES (?, ?, ?, ?, ?, 'd1_blob', ?, ?)
      `)
        .bind(attachmentId, input.emailId, input.filename, input.contentType, input.size, input.data, now)
        .run();
    }

    return attachmentId;
  }

  /**
   * 获取附件数据
   */
  static async getAttachment(env: Env, attachmentId: string): Promise<{
    filename: string;
    contentType: string;
    data: ArrayBuffer | ReadableStream;
  } | null> {
    const record = await env.DB.prepare(`
      SELECT id, filename, content_type, storage_type, storage_key, data_blob 
      FROM attachments WHERE id = ?
    `)
      .bind(attachmentId)
      .first<AttachmentRecord>();

    if (!record) return null;

    if (record.storage_type === 'r2' && record.storage_key && env.STORAGE) {
      const object = await env.STORAGE.get(record.storage_key);
      if (!object) return null;
      return {
        filename: record.filename,
        contentType: record.content_type,
        data: object.body,
      };
    } else if (record.data_blob) {
      return {
        filename: record.filename,
        contentType: record.content_type,
        data: record.data_blob as ArrayBuffer,
      };
    }

    return null;
  }

  /**
   * 删除邮件关联的所有附件
   */
  static async deleteEmailAttachments(env: Env, emailId: string): Promise<void> {
    if (env.STORAGE) {
      const { results } = await env.DB.prepare(`
        SELECT storage_key FROM attachments WHERE email_id = ? AND storage_type = 'r2'
      `)
        .bind(emailId)
        .all<{ storage_key: string }>();

      for (const item of results) {
        if (item.storage_key) {
          try {
            await env.STORAGE.delete(item.storage_key);
          } catch (e) {
            console.error('Failed to delete attachment from R2:', e);
          }
        }
      }
    }

    await env.DB.prepare('DELETE FROM attachments WHERE email_id = ?')
      .bind(emailId)
      .run();
  }
}
