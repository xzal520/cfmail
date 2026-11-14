-- Cloudflare D1 Database Schema for Cloud Mail
-- 全栈 Cloudflare 域名邮箱管理系统数据库结构

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
    is_active INTEGER NOT NULL DEFAULT 1,
    quota_bytes INTEGER NOT NULL DEFAULT 524288000, -- 默认 500MB
    used_bytes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. 托管域名表
CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    domain_name TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at INTEGER NOT NULL
);

-- 3. 邮箱别名表（一个用户可拥有多个邮箱前缀）
CREATE TABLE IF NOT EXISTS mailboxes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    address TEXT UNIQUE NOT NULL, -- e.g. hello@example.com
    domain_id TEXT,
    name TEXT, -- 显示姓名
    is_primary INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

-- 4. 邮件表
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    mailbox_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message_id TEXT,
    direction TEXT NOT NULL, -- 'inbound' | 'outbound'
    from_name TEXT,
    from_address TEXT NOT NULL,
    to_addresses TEXT NOT NULL, -- JSON array of [{name, address}]
    cc_addresses TEXT,         -- JSON array
    bcc_addresses TEXT,        -- JSON array
    reply_to TEXT,
    subject TEXT,
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    raw_size INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_trash INTEGER NOT NULL DEFAULT 0,
    is_spam INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
);

-- 5. 邮件附件表
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    email_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'd1_blob', -- 'd1_blob' | 'r2'
    storage_key TEXT,
    data_blob BLOB,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- 6. 系统设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER NOT NULL
);

-- 7. 发信审计日志表
CREATE TABLE IF NOT EXISTS send_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_addresses TEXT NOT NULL,
    subject TEXT,
    channel TEXT NOT NULL, -- 'resend' | 'smtp' | 'custom'
    status TEXT NOT NULL,  -- 'success' | 'failed'
    error_message TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引加速高频查询
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_mailboxes_user_id ON mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
CREATE INDEX IF NOT EXISTS idx_emails_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_emails_is_trash ON emails(is_trash);
CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);

-- 初始系统配置
INSERT OR IGNORE INTO settings (key, value, description, updated_at) VALUES 
('allow_registration', 'true', '是否开放用户自主注册', unixepoch()),
('default_quota_mb', '500', '新用户默认邮箱空间大小 (MB)', unixepoch()),
('max_mailboxes_per_user', '5', '每个普通用户允许创建的邮箱别名上限', unixepoch()),
('send_channel', 'resend', '发信服务提供商: resend | smtp', unixepoch()),
('resend_api_key', '', 'Resend API Key', unixepoch()),
('smtp_host', '', '自定义 SMTP 主机地址', unixepoch()),
('smtp_port', '465', 'SMTP 端口 (465 SSL / 587 STARTTLS)', unixepoch()),
('smtp_user', '', 'SMTP 账号', unixepoch()),
('smtp_pass', '', 'SMTP 密码', unixepoch()),
('smtp_secure', 'true', '是否使用 SSL/TLS 加密', unixepoch()),
('site_title', 'Cloud Mail', '系统显示标题', unixepoch());
