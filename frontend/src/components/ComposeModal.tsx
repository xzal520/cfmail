// frontend/src/components/ComposeModal.tsx
import React, { useState } from 'react';
import { Mailbox } from '../types';
import { X, Send, Paperclip, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { request } from '../lib/api';

interface ComposeModalProps {
  mailboxes: Mailbox[];
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  mailboxes,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  onClose,
  onSuccess,
}) => {
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>(
    mailboxes.find(m => m.is_primary)?.id || mailboxes[0]?.id || ''
  );
  const [toInput, setToInput] = useState(defaultTo);
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isHtmlMode, setIsHtmlMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 解析收件人
    const toList = toInput
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (toList.length === 0) {
      setError('请至少填写一个收件人邮箱');
      return;
    }

    const ccList = ccInput
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const bccList = bccInput
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    setLoading(true);

    try {
      await request('/send', {
        method: 'POST',
        body: JSON.stringify({
          mailboxId: selectedMailboxId,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: subject.trim() || '(无主题)',
          text: !isHtmlMode ? body : undefined,
          html: isHtmlMode ? body : undefined,
        }),
      });

      setSuccess('邮件已成功投递！');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送失败，请检查发信通道');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Send className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-sm">写新邮件</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 状态通知 */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-600 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-600 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 表单内容 */}
        <form onSubmit={handleSend} className="p-6 flex-1 flex flex-col space-y-3 overflow-y-auto">
          {/* 发件人 */}
          <div className="flex items-center space-x-3 text-sm">
            <label className="w-16 font-semibold text-slate-500 text-xs">发件地址</label>
            <div className="flex-1">
              <select
                value={selectedMailboxId}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              >
                {mailboxes.map((mb) => (
                  <option key={mb.id} value={mb.id}>
                    {mb.name ? `${mb.name} <${mb.address}>` : mb.address} {mb.is_primary ? '(主邮箱)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 收件人 */}
          <div className="flex items-center space-x-3 text-sm">
            <label className="w-16 font-semibold text-slate-500 text-xs">收件人</label>
            <div className="flex-1 flex items-center space-x-2">
              <input
                type="text"
                required
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                placeholder="example@domain.com (多个以逗号或空格隔开)"
                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCc(!showCc)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded"
              >
                {showCc ? '隐藏抄送' : '抄送/密送'}
              </button>
            </div>
          </div>

          {/* 抄送与密送 */}
          {showCc && (
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-in fade-in duration-150">
              <div className="flex items-center space-x-3 text-sm">
                <label className="w-16 font-semibold text-slate-500 text-xs">抄送 (Cc)</label>
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="cc@domain.com"
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <label className="w-16 font-semibold text-slate-500 text-xs">密送 (Bcc)</label>
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  placeholder="bcc@domain.com"
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* 主题 */}
          <div className="flex items-center space-x-3 text-sm">
            <label className="w-16 font-semibold text-slate-500 text-xs">主题</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="请输入邮件主题"
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 工具栏：模式切换 */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-semibold text-slate-600">邮件正文</span>
            <button
              type="button"
              onClick={() => setIsHtmlMode(!isHtmlMode)}
              className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              {isHtmlMode ? '当前：HTML 源码模式' : '当前：纯文本格式'}
            </button>
          </div>

          {/* 正文输入框 */}
          <div className="flex-1 min-h-[220px]">
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={isHtmlMode ? '请在此输入 HTML 代码，例如 <h2>你好</h2><p>正文内容...</p>' : '请在此输入邮件正文...'}
              className="w-full h-full min-h-[220px] p-3 border border-slate-200 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans resize-none"
            />
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-400">
              支持纯文本与完整 HTML 格式发送
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm shadow-blue-500/20"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? '投递中...' : '发送'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
