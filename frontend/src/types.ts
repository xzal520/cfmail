// frontend/src/types.ts

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  is_active: number;
  quota_bytes: number;
  used_bytes: number;
  created_at: number;
  primaryAddress?: string;
  mailboxes?: Mailbox[];
}

export interface Mailbox {
  id: string;
  user_id: string;
  address: string;
  domain_id?: string;
  domain_name?: string;
  name?: string;
  is_primary: number;
  is_active: number;
  created_at: number;
}

export interface EmailItem {
  id: string;
  mailbox_id: string;
  mailbox_address?: string;
  direction: 'inbound' | 'outbound';
  from_name?: string;
  from_address: string;
  to_addresses: string;
  subject: string;
  snippet: string;
  is_read: number;
  is_starred: number;
  is_trash: number;
  created_at: number;
  raw_size: number;
  attachment_count: number;
}

export interface EmailDetail extends EmailItem {
  to_addresses: Array<{ name: string; address: string }>;
  cc_addresses?: Array<{ name: string; address: string }>;
  bcc_addresses?: Array<{ name: string; address: string }>;
  reply_to?: string;
  body_text?: string;
  body_html?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: number;
}

export interface EmailStats {
  inboxUnread: number;
  inboxTotal: number;
  sentTotal: number;
  starredTotal: number;
  trashTotal: number;
}

export interface DomainItem {
  id: string;
  domain_name: string;
  is_active: number;
  is_default: number;
  description?: string;
  mailbox_count?: number;
  created_at: number;
}

export interface AdminOverview {
  totalUsers: number;
  totalDomains: number;
  totalMailboxes: number;
  totalEmails: number;
  todayEmails: number;
  totalStorageBytes: number;
}

export interface SendLog {
  id: string;
  user_id: string;
  username?: string;
  from_address: string;
  to_addresses: string;
  subject: string;
  channel: string;
  status: 'success' | 'failed';
  error_message?: string;
  created_at: number;
}
