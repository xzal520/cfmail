// frontend/src/components/Navbar.tsx
import React, { useState } from 'react';
import { User } from '../types';
import { Mail, Shield, LogOut, Key, HardDrive, LayoutDashboard, Inbox } from 'lucide-react';
import { request, formatBytes } from '../lib/api';

interface NavbarProps {
  user: User;
  activeView: 'mailbox' | 'admin';
  onViewChange: (view: 'mailbox' | 'admin') => void;
  onLogout: () => void;
  onUserUpdate: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onViewChange,
  onLogout,
}) => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const usedPercent = user.quota_bytes > 0
    ? Math.min(100, Math.round((user.used_bytes / user.quota_bytes) * 100))
    : 0;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await request('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setSuccess('密码修改成功');
      setTimeout(() => {
        setShowPasswordModal(false);
        setSuccess('');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        {/* Logo 区域 */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Cloud Mail
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                Cloudflare
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">高性能云原生域名邮箱</p>
          </div>
        </div>

        {/* 视窗切换（仅管理员展示） */}
        <div className="flex items-center space-x-2">
          {user.role === 'admin' && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-sm">
              <button
                onClick={() => onViewChange('mailbox')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeView === 'mailbox'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>邮箱主页</span>
              </button>
              <button
                onClick={() => onViewChange('admin')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  activeView === 'admin'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>管理后台</span>
              </button>
            </div>
          )}
        </div>

        {/* 右侧用户状态与操作 */}
        <div className="flex items-center space-x-4">
          {/* 容量展示 */}
          <div className="hidden lg:flex flex-col items-end text-xs text-slate-500">
            <div className="flex items-center space-x-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {formatBytes(user.used_bytes)} / {formatBytes(user.quota_bytes)}
              </span>
            </div>
            <div className="w-24 bg-slate-200 h-1.5 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${
                  usedPercent > 90 ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* 用户身份与菜单 */}
          <div className="flex items-center space-x-2">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight flex items-center justify-end space-x-1">
                <span>{user.username}</span>
                {user.role === 'admin' && (
                  <Shield className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />
                )}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {user.primaryAddress || `${user.username}@...`}
              </div>
            </div>

            <button
              onClick={() => setShowPasswordModal(true)}
              title="修改密码"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              title="退出登录"
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <Key className="w-5 h-5 text-blue-600" />
              <span>修改账户密码</span>
            </h3>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  当前原密码
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入当前正在使用的密码"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  新密码
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="至少 6 个字符"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  确认新密码
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="再次输入新密码"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  {loading ? '保存中...' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
