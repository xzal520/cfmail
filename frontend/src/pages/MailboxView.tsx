// frontend/src/pages/MailboxView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  Send,
  Star,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  Paperclip,
  ArrowLeft,
  Reply,
  Download,
  Plus,
  Mail,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { request, formatDate, formatFullDate, formatBytes } from '../lib/api';
import { User, Mailbox, EmailItem, EmailDetail, EmailStats, DomainItem } from '../types';
import { ComposeModal } from '../components/ComposeModal';

interface MailboxViewProps {
  user: User;
  onRefreshUser: () => void;
}

// 将邮件 HTML 中的外部图片转为内置代理，解决网络阻断（如 Claude/国外图片）与防盗链问题
function processEmailHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  let processed = rawHtml;

  // 1. 替换 <img src="..."> 为内置图片加速代理
  processed = processed.replace(
    /<img\b([^>]*?)\bsrc=(["']?)(https?:\/\/[^"'\s>]+)\2([^>]*?)>/gi,
    (match, before, quote, url, after) => {
      if (url.includes('/api/proxy-image') || url.startsWith('data:')) {
        return match;
      }
      const q = quote || '"';
      const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      return `<img${before}src=${q}${proxiedUrl}${q} referrerpolicy="no-referrer"${after}>`;
    }
  );

  // 2. 替换 background="..." 属性
  processed = processed.replace(
    /\bbackground=(["']?)(https?:\/\/[^"'\s>]+)\1/gi,
    (match, quote, url) => {
      if (url.includes('/api/proxy-image') || url.startsWith('data:')) return match;
      const q = quote || '"';
      return `background=${q}/api/proxy-image?url=${encodeURIComponent(url)}${q}`;
    }
  );

  return processed;
}

export const MailboxView: React.FC<MailboxViewProps> = ({ user, onRefreshUser }) => {
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'sent' | 'starred' | 'trash'>('inbox');
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>(''); // 空表示全部
  const [mailboxes, setMailboxes] = useState<Mailbox[]>(user.mailboxes || []);
  const [domains, setDomains] = useState<DomainItem[]>([]);

  // 邮件列表与统计
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [stats, setStats] = useState<EmailStats>({
    inboxUnread: 0,
    inboxTotal: 0,
    sentTotal: 0,
    starredTotal: 0,
    trashTotal: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  // 当前选中阅读的邮件
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // 写信弹窗
  const [showCompose, setShowCompose] = useState(false);
  const [composeDefaults, setComposeDefaults] = useState<{ to?: string; subject?: string; body?: string }>({});

  // 添加新邮箱别名弹窗
  const [showAddAlias, setShowAddAlias] = useState(false);
  const [newAliasPrefix, setNewAliasPrefix] = useState('');
  const [newAliasDomainId, setNewAliasDomainId] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);
  const [aliasError, setAliasError] = useState('');

  // 加载统计信息
  const fetchStats = useCallback(async () => {
    try {
      const data = await request<EmailStats>('/emails/stats');
      setStats(data);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }, []);

  // 加载邮箱别名列表
  const fetchMailboxes = useCallback(async () => {
    try {
      const data = await request<Mailbox[]>('/mailboxes');
      setMailboxes(data);
    } catch (e) {
      console.error('Failed to load mailboxes:', e);
    }
  }, []);

  // 加载可用域名
  const fetchDomains = useCallback(async () => {
    try {
      const data = await request<DomainItem[]>('/auth/public-domains');
      setDomains(data || []);
      if (data && data.length > 0 && !newAliasDomainId) {
        setNewAliasDomainId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to load domains:', e);
    }
  }, [newAliasDomainId]);

  // 加载邮件列表
  const fetchEmails = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      params.append('folder', activeFolder);
      if (selectedMailboxId) params.append('mailbox_id', selectedMailboxId);
      if (searchQuery) params.append('search', searchQuery);
      if (unreadOnly) params.append('unread', 'true');

      const data = await request<{ items: EmailItem[] }>(`/emails?${params.toString()}`);
      setEmails(data.items || []);

      // 如果当前选中的邮件不在列表中，清除选中
      if (selectedEmailId && !data.items.some(m => m.id === selectedEmailId)) {
        // 保留或者清空
      }
    } catch (e) {
      console.error('Failed to load emails:', e);
    } finally {
      setLoadingList(false);
    }
  }, [activeFolder, selectedMailboxId, searchQuery, unreadOnly, selectedEmailId]);

  // 加载邮件详情
  const fetchEmailDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await request<EmailDetail>(`/emails/${id}`);
      setEmailDetail(data);
      // 更新列表中已读状态
      setEmails(prev => prev.map(m => (m.id === id ? { ...m, is_read: 1 } : m)));
      fetchStats();
    } catch (e) {
      console.error('Failed to load email detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
    fetchMailboxes();
    fetchDomains();
  }, [fetchStats, fetchMailboxes, fetchDomains]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    if (selectedEmailId) {
      fetchEmailDetail(selectedEmailId);
    } else {
      setEmailDetail(null);
    }
  }, [selectedEmailId, fetchEmailDetail]);

  // 切换星标
  const handleToggleStar = async (emailId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await request(`/emails/${emailId}/star`, { method: 'PATCH' });
      setEmails(prev => prev.map(m => (m.id === emailId ? { ...m, is_starred: m.is_starred ? 0 : 1 } : m)));
      if (emailDetail && emailDetail.id === emailId) {
        setEmailDetail(prev => prev ? { ...prev, is_starred: prev.is_starred ? 0 : 1 } : null);
      }
      fetchStats();
    } catch (err) {
      console.error('Toggle star failed:', err);
    }
  };

  // 删除 / 彻底删除邮件
  const handleDeleteEmail = async (emailId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await request(`/emails/${emailId}`, { method: 'DELETE' });
      setEmails(prev => prev.filter(m => m.id !== emailId));
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setEmailDetail(null);
      }
      fetchStats();
      onRefreshUser();
    } catch (err) {
      console.error('Delete email failed:', err);
    }
  };

  // 恢复邮件
  const handleRestoreEmail = async (emailId: string) => {
    try {
      await request(`/emails/${emailId}/restore`, { method: 'POST' });
      setEmails(prev => prev.filter(m => m.id !== emailId));
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setEmailDetail(null);
      }
      fetchStats();
    } catch (err) {
      console.error('Restore email failed:', err);
    }
  };

  // 回复邮件
  const handleReply = (email: EmailDetail) => {
    setComposeDefaults({
      to: email.from_address,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n------------------ 原始邮件 ------------------\n发件人: ${email.from_name || ''} <${email.from_address}>\n日期: ${formatFullDate(email.created_at)}\n主题: ${email.subject}\n\n${email.body_text || ''}`,
    });
    setShowCompose(true);
  };

  // 添加别名提交
  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    setAliasError('');
    setAddingAlias(true);

    try {
      await request('/mailboxes', {
        method: 'POST',
        body: JSON.stringify({
          prefix: newAliasPrefix,
          domainId: newAliasDomainId,
        }),
      });

      setShowAddAlias(false);
      setNewAliasPrefix('');
      fetchMailboxes();
      onRefreshUser();
    } catch (err: unknown) {
      setAliasError(err instanceof Error ? err.message : '添加失败');
    } finally {
      setAddingAlias(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
      {/* 1. 左侧导航边栏 */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 flex-shrink-0">
        {/* 写信主按钮 */}
        <button
          onClick={() => {
            setComposeDefaults({});
            setShowCompose(true);
          }}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-[0.99] mb-6"
        >
          <Edit className="w-4 h-4" />
          <span>写邮件</span>
        </button>

        {/* 邮箱别名选择与管理 */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
            <span>我的邮箱别名</span>
            <button
              onClick={() => setShowAddAlias(true)}
              title="添加新别名"
              className="text-blue-600 hover:text-blue-700 flex items-center space-x-0.5 normal-case font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建</span>
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setSelectedMailboxId('')}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                selectedMailboxId === ''
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="truncate">全部邮箱</span>
              <span className="text-[10px] bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded-full">
                {mailboxes.length}
              </span>
            </button>

            {mailboxes.map(mb => (
              <button
                key={mb.id}
                onClick={() => setSelectedMailboxId(mb.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono flex items-center justify-between transition-colors ${
                  selectedMailboxId === mb.id
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{mb.address}</span>
                {mb.is_primary === 1 && (
                  <span className="text-[10px] text-blue-600 bg-blue-100/70 px-1 rounded">主</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 文件夹导航 */}
        <nav className="space-y-1.5 flex-1">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
            文件夹
          </div>

          <button
            onClick={() => { setActiveFolder('inbox'); setSelectedEmailId(null); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeFolder === 'inbox'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Inbox className="w-4 h-4" />
              <span>收件箱</span>
            </div>
            {stats.inboxUnread > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {stats.inboxUnread}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveFolder('sent'); setSelectedEmailId(null); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeFolder === 'sent'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className="w-4 h-4" />
              <span>已发送</span>
            </div>
            <span className="text-xs text-slate-400">{stats.sentTotal}</span>
          </button>

          <button
            onClick={() => { setActiveFolder('starred'); setSelectedEmailId(null); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeFolder === 'starred'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Star className="w-4 h-4" />
              <span>星标邮件</span>
            </div>
            <span className="text-xs text-slate-400">{stats.starredTotal}</span>
          </button>

          <button
            onClick={() => { setActiveFolder('trash'); setSelectedEmailId(null); }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeFolder === 'trash'
                ? 'bg-blue-50 text-blue-600 font-bold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Trash2 className="w-4 h-4" />
              <span>垃圾箱</span>
            </div>
            <span className="text-xs text-slate-400">{stats.trashTotal}</span>
          </button>
        </nav>
      </aside>

      {/* 2. 中间邮件列表 */}
      <section
        className={`w-full md:w-[380px] lg:w-[420px] bg-slate-50/70 border-r border-slate-200 flex flex-col flex-shrink-0 ${
          selectedEmailId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* 搜索与工具栏 */}
        <div className="p-3.5 bg-white border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索主题、发件人..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <button
              onClick={() => setUnreadOnly(!unreadOnly)}
              className={`px-2.5 py-1 rounded-lg border transition-colors ${
                unreadOnly
                  ? 'bg-blue-50 border-blue-200 text-blue-600 font-medium'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              仅看未读
            </button>

            <button
              onClick={() => { fetchEmails(); fetchStats(); }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
              title="刷新列表"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 邮件项列表 */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingList && emails.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">加载邮件中...</div>
          ) : emails.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Mail className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-medium">该文件夹暂无邮件</p>
            </div>
          ) : (
            emails.map((mail) => (
              <div
                key={mail.id}
                onClick={() => setSelectedEmailId(mail.id)}
                className={`p-4 cursor-pointer transition-colors relative group ${
                  selectedEmailId === mail.id
                    ? 'bg-blue-50/80 border-l-4 border-blue-600'
                    : mail.is_read === 0
                    ? 'bg-white font-semibold'
                    : 'bg-white/60 hover:bg-slate-100/70'
                }`}
              >
                {/* 未读蓝点 */}
                {mail.is_read === 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-600 absolute left-2 top-5" />
                )}

                <div className="flex items-start justify-between mb-1">
                  <div className="truncate text-xs font-bold text-slate-900 pr-2">
                    {mail.direction === 'outbound' ? '发送至: ' + mail.to_addresses : (mail.from_name || mail.from_address)}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                    {formatDate(mail.created_at)}
                  </div>
                </div>

                <div className="text-xs text-slate-800 font-medium truncate mb-1">
                  {mail.subject || '(无主题)'}
                </div>

                <div className="text-xs text-slate-400 line-clamp-1">
                  {mail.snippet || '(无内容)'}
                </div>

                {/* 底部小标识与快捷操作 */}
                <div className="flex items-center justify-between mt-2 pt-1">
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                    {mail.attachment_count > 0 && (
                      <span className="flex items-center space-x-0.5 text-blue-600 bg-blue-50 px-1 rounded">
                        <Paperclip className="w-3 h-3" />
                        <span>{mail.attachment_count}</span>
                      </span>
                    )}
                    <span className="font-mono text-slate-400">{mail.mailbox_address}</span>
                  </div>

                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleToggleStar(mail.id, e)}
                      className="p-1 hover:text-amber-500 text-slate-400"
                    >
                      <Star className={`w-3.5 h-3.5 ${mail.is_starred ? 'text-amber-500 fill-amber-500' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteEmail(mail.id, e)}
                      className="p-1 hover:text-rose-500 text-slate-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 3. 右侧邮件阅读面板 */}
      <main className={`flex-1 bg-white flex flex-col ${selectedEmailId ? 'flex' : 'hidden md:flex'}`}>
        {selectedEmailId && emailDetail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 邮件工具栏 */}
            <div className="h-14 px-6 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedEmailId(null)}
                  className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleReply(emailDetail)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Reply className="w-4 h-4 text-blue-600" />
                  <span>回复</span>
                </button>
                <button
                  onClick={() => handleToggleStar(emailDetail.id)}
                  className={`p-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 ${
                    emailDetail.is_starred ? 'text-amber-500' : 'text-slate-500'
                  }`}
                  title="星标"
                >
                  <Star className={`w-4 h-4 ${emailDetail.is_starred ? 'fill-amber-500 text-amber-500' : ''}`} />
                </button>
                <button
                  onClick={() => handleDeleteEmail(emailDetail.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{emailDetail.is_trash ? '彻底删除' : '删除'}</span>
                </button>
                {emailDetail.is_trash === 1 && (
                  <button
                    onClick={() => handleRestoreEmail(emailDetail.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>恢复到收件箱</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400 font-mono">
                {formatFullDate(emailDetail.created_at)}
              </div>
            </div>

            {/* 邮件正文滚动区 */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              {/* 主题 */}
              <h2 className="text-xl font-bold text-slate-900 leading-snug">
                {emailDetail.subject || '(无主题)'}
              </h2>

              {/* 发件人/收件人卡片 */}
              <div className="flex items-start justify-between bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {(emailDetail.from_name || emailDetail.from_address || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">
                        {emailDetail.from_name || emailDetail.from_address}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        &lt;{emailDetail.from_address}&gt;
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      发送至：
                      {emailDetail.to_addresses && emailDetail.to_addresses.map((to, i) => (
                        <span key={i} className="font-mono text-slate-700 ml-1">
                          {to.name ? `${to.name} <${to.address}>` : to.address}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 附件区 */}
              {emailDetail.attachments && emailDetail.attachments.length > 0 && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span>附件 ({emailDetail.attachments.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {emailDetail.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm hover:border-blue-400 transition-colors"
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <div className="truncate">
                            <div className="text-xs font-semibold text-slate-800 truncate" title={att.filename}>
                              {att.filename}
                            </div>
                            <div className="text-[10px] text-slate-400">{formatBytes(att.size)}</div>
                          </div>
                        </div>
                        <a
                          href={`/api/emails/${emailDetail.id}/attachments/${att.id}`}
                          download={att.filename}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="下载附件"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 正文渲染（沙箱隔离，安全呈现 HTML 或纯文本） */}
              <div className="pt-2">
                {emailDetail.body_html ? (
                  <iframe
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <meta name="referrer" content="no-referrer">
                          <base target="_blank">
                          <style>
                            body {
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                              line-height: 1.6;
                              color: #1e293b;
                              margin: 0;
                              padding: 12px;
                              word-break: break-word;
                            }
                            a { color: #2563eb; }
                            img { max-width: 100%; height: auto; }
                          </style>
                        </head>
                        <body>${processEmailHtml(emailDetail.body_html)}</body>
                      </html>
                    `}
                    title="Email Body"
                    className="w-full min-h-[420px] border-none rounded-xl bg-white"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    {emailDetail.body_text || '(无正文内容)'}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
            <Mail className="w-16 h-16 text-slate-200 mb-3" />
            <h4 className="font-semibold text-slate-600 text-sm">选择左侧邮件以查看详情</h4>
            <p className="text-xs text-slate-400 mt-1">支持随时在线写信、多邮箱别名管理与附件下载</p>
          </div>
        )}
      </main>

      {/* 写信模态框 */}
      {showCompose && (
        <ComposeModal
          mailboxes={mailboxes}
          defaultTo={composeDefaults.to}
          defaultSubject={composeDefaults.subject}
          defaultBody={composeDefaults.body}
          onClose={() => setShowCompose(false)}
          onSuccess={() => {
            fetchEmails();
            fetchStats();
            onRefreshUser();
          }}
        />
      )}

      {/* 添加新别名模态框 */}
      {showAddAlias && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-3">创建新邮箱别名</h3>
            <p className="text-xs text-slate-500 mb-4">
              您可以绑定多个邮箱前缀，发信和收信均可在这些别名间自由切换。
            </p>

            {aliasError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
                {aliasError}
              </div>
            )}

            <form onSubmit={handleAddAlias} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">自定义前缀</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    value={newAliasPrefix}
                    onChange={(e) => setNewAliasPrefix(e.target.value)}
                    placeholder="如: contact, billing"
                    className="w-1/2 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <select
                    value={newAliasDomainId}
                    onChange={(e) => setNewAliasDomainId(e.target.value)}
                    className="w-1/2 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        @{d.domain_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddAlias(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={addingAlias}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  {addingAlias ? '创建中...' : '确认创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
