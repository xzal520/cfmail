// src/types.ts
export interface Env {
  DB: D1Database;
  STORAGE?: R2Bucket;
  JWT_SECRET?: string;
  ADMIN_INVITE_CODE?: string;
  ASSETS?: Fetcher;
}

export interface User {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'user';
  is_active: number;
  quota_bytes: number;
  used_bytes: number;
  created_at: number;
  updated_at: number;
}

export interface Domain {
  id: string;
  domain_name: string;
  is_active: number;
  is_default: number;
  description?: string;
  created_at: number;
}

export interface Mailbox {
  id: string;
  user_id: string;
  address: string;
  domain_id?: string;
  name?: string;
  is_primary: number;
  is_active: number;
  created_at: number;
}

export interface EmailRecord {
  id: string;
  mailbox_id: string;
  user_id: string;
  message_id?: string;
  direction: 'inbound' | 'outbound';
  from_name?: string;
  from_address: string;
  to_addresses: string; // JSON string
  cc_addresses?: string; // JSON string
  bcc_addresses?: string; // JSON string
  reply_to?: string;
  subject?: string;
  snippet?: string;
  body_text?: string;
  body_html?: string;
  raw_size: number;
  is_read: number;
  is_starred: number;
  is_trash: number;
  is_spam: number;
  created_at: number;
}

export interface AttachmentRecord {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  size: number;
  storage_type: 'd1_blob' | 'r2';
  storage_key?: string;
  data_blob?: ArrayBuffer | Uint8Array;
  created_at: number;
}

export interface SettingRecord {
  key: string;
  value: string;
  description?: string;
  updated_at: number;
}

export interface SendLogRecord {
  id: string;
  user_id: string;
  from_address: string;
  to_addresses: string;
  subject?: string;
  channel: string;
  status: 'success' | 'failed';
  error_message?: string;
  created_at: number;
}

export interface AuthPayload {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  exp: number;
}
