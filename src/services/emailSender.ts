// src/services/emailSender.ts
import { Env, SendLogRecord } from '../types';
import { generateId, currentTimestamp, getSetting } from '../utils/db';

export interface SendEmailOptions {
  userId: string;
  fromName?: string;
  fromAddress: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 或纯文本
    contentType?: string;
  }>;
}

export class EmailSenderService {
  /**
   * 发送邮件并写入日志
   */
  static async send(env: Env, options: SendEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const channel = await getSetting(env.DB, 'send_channel', 'resend');
    let success = false;
    let errorMsg: string | undefined;
    let externalId: string | undefined;

    try {
      if (channel === 'resend') {
        const result = await this.sendViaResend(env, options);
        success = result.success;
        errorMsg = result.error;
        externalId = result.id;
      } else {
        // 自定义或外部 SMTP 网关
        const result = await this.sendViaCustomGateway(env, options);
        success = result.success;
        errorMsg = result.error;
      }
    } catch (err: unknown) {
      success = false;
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    // 记录发信日志到数据库
    try {
      const logId = generateId();
      await env.DB.prepare(`
        INSERT INTO send_logs (id, user_id, from_address, to_addresses, subject, channel, status, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          logId,
          options.userId,
          options.fromAddress,
          JSON.stringify(options.to),
          options.subject || '(无主题)',
          channel,
          success ? 'success' : 'failed',
          errorMsg || null,
          currentTimestamp()
        )
        .run();
    } catch (logErr) {
      console.error('Failed to write send log:', logErr);
    }

    return {
      success,
      error: errorMsg,
      messageId: externalId,
    };
  }

  /**
   * 通过 Resend API 发送邮件 (推荐方案)
   */
  private static async sendViaResend(
    env: Env,
    options: SendEmailOptions
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiKey = await getSetting(env.DB, 'resend_api_key');
    if (!apiKey) {
      return {
        success: false,
        error: '未配置 Resend API Key，请联系管理员在后台设置',
      };
    }

    const fromDisplay = options.fromName
      ? `${options.fromName} <${options.fromAddress}>`
      : options.fromAddress;

    const payload: Record<string, unknown> = {
      from: fromDisplay,
      to: options.to,
      subject: options.subject,
    };

    if (options.cc && options.cc.length > 0) payload.cc = options.cc;
    if (options.bcc && options.bcc.length > 0) payload.bcc = options.bcc;
    if (options.replyTo) payload.reply_to = options.replyTo;
    if (options.html) payload.html = options.html;
    if (options.text) payload.text = options.text;
    if (!options.html && !options.text) payload.text = ' ';

    if (options.attachments && options.attachments.length > 0) {
      payload.attachments = options.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
      }));
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errMsg = (data && typeof data === 'object' && 'message' in data)
        ? String(data.message)
        : `Resend API HTTP ${response.status}`;
      return { success: false, error: errMsg };
    }

    return { success: true, id: data.id ? String(data.id) : undefined };
  }

  /**
   * 自定义/外部 HTTP 发信网关
   */
  private static async sendViaCustomGateway(
    env: Env,
    options: SendEmailOptions
  ): Promise<{ success: boolean; error?: string }> {
    const smtpHost = await getSetting(env.DB, 'smtp_host');
    if (!smtpHost) {
      return {
        success: false,
        error: 'SMTP 主机未配置，请在后台设置发信通道',
      };
    }

    // 可通过自定义 Webhook 或专用发信中间件实现
    return {
      success: false,
      error: 'SMTP 纯直连需配置专有发信端点或推荐切换至 Resend API 通道',
    };
  }

  /**
   * 测试发信渠道配置
   */
  static async testConnection(env: Env, targetEmail: string): Promise<{ success: boolean; message: string }> {
    const channel = await getSetting(env.DB, 'send_channel', 'resend');
    if (channel === 'resend') {
      const apiKey = await getSetting(env.DB, 'resend_api_key');
      if (!apiKey) {
        return { success: false, message: '请先填写 Resend API Key' };
      }

      // 获取系统第一个激活的域名或邮箱
      const mailbox = await env.DB.prepare('SELECT address FROM mailboxes LIMIT 1').first<{ address: string }>();
      const fromAddr = mailbox?.address || 'onboarding@resend.dev';

      const res = await this.sendViaResend(env, {
        userId: 'admin_test',
        fromName: 'Cloud Mail Test',
        fromAddress: fromAddr,
        to: [targetEmail],
        subject: '【Cloud Mail】测试邮件：发信通道连通性正常',
        html: `
          <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
            <h2 style="color: #2563eb;">恭喜！Cloud Mail 发信通道测试成功</h2>
            <p>这是一封由您的 Cloud Mail 域名邮箱管理系统发出的测试邮件。</p>
            <p><strong>当前发信渠道：</strong> Resend API</p>
            <p><strong>发送时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">Cloud Mail - 基于 Cloudflare 全栈构建的开源域名邮箱系统</p>
          </div>
        `,
      });

      if (res.success) {
        return { success: true, message: '测试邮件已成功发出，请检查收件箱（包括垃圾箱）！' };
      } else {
        return { success: false, message: `发信失败: ${res.error}` };
      }
    }

    return { success: false, message: `暂不支持该发信渠道测试: ${channel}` };
  }
}
