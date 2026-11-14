// frontend/src/pages/Auth.tsx
import React, { useState, useEffect } from 'react';
import { Mail, Lock, User as UserIcon, Shield, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { request } from '../lib/api';
import { User, DomainItem } from '../types';

interface AuthProps {
  onSuccess: (user: User, token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [domains, setDomains] = useState<DomainItem[]>([]);

  // 登录表单
  const [loginAccount, setLoginAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 注册表单
  const [regUsername, setRegUsername] = useState('');
  const [regPrefix, setRegPrefix] = useState('');
  const [regDomainId, setRegDomainId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载可用域名
  useEffect(() => {
    request<DomainItem[]>('/auth/public-domains')
      .then((data) => {
        setDomains(data || []);
        if (data && data.length > 0) {
          const defaultDomain = data.find(d => d.is_default) || data[0];
          setRegDomainId(defaultDomain.id);
        }
      })
      .catch((err) => console.error('Failed to load domains:', err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          account: loginAccount,
          password: loginPassword,
        }),
      });

      localStorage.setItem('cfmail_token', res.token);
      localStorage.setItem('cfmail_user', JSON.stringify(res.user));
      onSuccess(res.user, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await request<{ user: User; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          mailboxPrefix: regPrefix || regUsername,
          domainId: regDomainId,
          inviteCode: regInviteCode || undefined,
        }),
      });

      localStorage.setItem('cfmail_token', res.token);
      localStorage.setItem('cfmail_user', JSON.stringify(res.user));
      onSuccess(res.user, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const selectedDomain = domains.find(d => d.id === regDomainId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-4">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Cloud Mail</h1>
          <p className="text-sm text-slate-500 mt-1">基于 Cloudflare 全栈构建的域名邮箱系统</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 text-sm font-semibold">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            登录账号
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              !isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            新用户注册
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 登录表单 */}
        {isLogin ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                账号 / 邮箱地址
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={loginAccount}
                  onChange={(e) => setLoginAccount(e.target.value)}
                  placeholder="用户名 或 user@yourdomain.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="请输入您的登录密码"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all hover:translate-y-[-1px] active:translate-y-0"
            >
              <span>{loading ? '正在登录...' : '立即登录'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* 注册表单 */
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                用户账号 (Username)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => {
                    setRegUsername(e.target.value);
                    if (!regPrefix) setRegPrefix(e.target.value);
                  }}
                  placeholder="英文字母、数字"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>
            </div>

            {/* 邮箱前缀与域名绑定 */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                分配个人域名邮箱
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={regPrefix || regUsername}
                  onChange={(e) => setRegPrefix(e.target.value)}
                  placeholder="前缀"
                  className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <select
                  value={regDomainId}
                  onChange={(e) => setRegDomainId(e.target.value)}
                  className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono truncate"
                >
                  {domains.length > 0 ? (
                    domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        @{d.domain_name}
                      </option>
                    ))
                  ) : (
                    <option value="">@localhost</option>
                  )}
                </select>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                生成的邮箱：
                <span className="font-mono text-blue-600 font-semibold">
                  {(regPrefix || regUsername || 'yourname')}@{selectedDomain?.domain_name || 'localhost'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                设置密码
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>管理员邀请码 (选填)</span>
                <span className="text-[11px] text-slate-400 font-normal">首位注册者自动成为管理员</span>
              </label>
              <div className="relative">
                <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={regInviteCode}
                  onChange={(e) => setRegInviteCode(e.target.value)}
                  placeholder="若无请留空即可"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all hover:translate-y-[-1px] active:translate-y-0"
            >
              <span>{loading ? '创建账号中...' : '立即注册'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-slate-400">
          Cloudflare Workers • D1 Database • Email Routing
        </div>
      </div>
    </div>
  );
};
