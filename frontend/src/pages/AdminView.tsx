// frontend/src/pages/AdminView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Globe,
  Settings as SettingsIcon,
  Shield,
  HardDrive,
  Mail,
  Send,
  Plus,
  Trash2,
  Key,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Search,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { request, formatBytes, formatFullDate } from '../lib/api';
import { AdminOverview, DomainItem, SendLog } from '../types';
import { DnsGuideModal } from '../components/DnsGuideModal';

export const AdminView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'domains' | 'users' | 'settings' | 'logs'>('overview');

  // 1. 概览数据
  const [overview, setOverview] = useState<AdminOverview | null>(null);

  // 2. 域名管理
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [newDomainDefault, setNewDomainDefault] = useState(false);
  const [selectedDnsDomain, setSelectedDnsDomain] = useState<{ domain: string; records: any[] } | null>(null);

  // 3. 用户管理
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [resetPwdModal, setResetPwdModal] = useState<{ userId: string; username: string } | null>(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [quotaModal, setQuotaModal] = useState<{ userId: string; username: string; currentMb: number } | null>(null);
  const [newQuotaMb, setNewQuotaMb] = useState<number>(500);

  // 4. 系统设置与测试发信
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [testEmailAddr, setTestEmailAddr] = useState('');
  const [testingSend, setTestingSend] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // 5. 日志
  const [logs, setLogs] = useState<SendLog[]>([]);

  // 状态反馈
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  // 加载数据
  const loadOverview = useCallback(async () => {
    try {
      const data = await request<AdminOverview>('/admin/overview');
      setOverview(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadDomains = useCallback(async () => {
    try {
      const data = await request<DomainItem[]>('/admin/domains');
      setDomains(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const params = userSearch ? `?search=${encodeURIComponent(userSearch)}` : '';
      const data = await request<{ items: any[] }>(`/admin/users${params}`);
      setUsersList(data.items || []);
    } catch (e) {
      console.error(e);
    }
  }, [userSearch]);

  const loadSettings = useCallback(async () => {
    try {
      const data = await request<Record<string, string>>('/admin/settings');
      setSettings(data || {});
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const data = await request<SendLog[]>('/admin/logs');
      setLogs(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
    if (activeTab === 'domains') loadDomains();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'settings') loadSettings();
    if (activeTab === 'logs') loadLogs();
  }, [activeTab, loadOverview, loadDomains, loadUsers, loadSettings, loadLogs]);

  // 域名操作
  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request('/admin/domains', {
        method: 'POST',
        body: JSON.stringify({
          domainName: newDomainName,
          description: newDomainDesc,
          isDefault: newDomainDefault,
        }),
      });
      showMsg('域名添加成功');
      setNewDomainName('');
      setNewDomainDesc('');
      setNewDomainDefault(false);
      loadDomains();
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '添加失败', 'error');
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('确定要删除该托管域名吗？')) return;
    try {
      await request(`/admin/domains/${domainId}`, { method: 'DELETE' });
      showMsg('域名已删除');
      loadDomains();
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  const handleShowDns = async (domainId: string) => {
    try {
      const data = await request<{ domain: string; records: any[] }>(`/admin/domains/${domainId}/dns`);
      setSelectedDnsDomain(data);
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '获取 DNS 指南失败', 'error');
    }
  };

  // 用户操作
  const handleToggleUserStatus = async (userId: string, currentActive: number) => {
    try {
      await request(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: currentActive !== 1 }),
      });
      showMsg('用户状态已更新');
      loadUsers();
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  const handleToggleUserRole = async (userId: string, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`确定要将该用户角色切换为【${nextRole === 'admin' ? '管理员' : '普通用户'}】吗？`)) return;
    try {
      await request(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      showMsg('角色已变更');
      loadUsers();
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdModal) return;
    try {
      await request(`/admin/users/${resetPwdModal.userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPasswordForUser }),
      });
      showMsg(`用户 ${resetPwdModal.username} 密码已重置成功`);
      setResetPwdModal(null);
      setNewPasswordForUser('');
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '重置失败', 'error');
    }
  };

  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModal) return;
    try {
      await request(`/admin/users/${quotaModal.userId}/quota`, {
        method: 'PUT',
        body: JSON.stringify({ quotaMb: newQuotaMb }),
      });
      showMsg(`用户 ${quotaModal.username} 配额已更新为 ${newQuotaMb}MB`);
      setQuotaModal(null);
      loadUsers();
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '修改配额失败', 'error');
    }
  };

  // 保存设置
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await request('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      showMsg('全局系统设置已成功保存');
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : '保存失败', 'error');
    }
  };

  // 测试发信
  const handleTestSend = async () => {
    if (!testEmailAddr) {
      showMsg('请先输入接收测试邮件的目标邮箱', 'error');
      return;
    }
    setTestingSend(true);
    setTestResult(null);

    try {
      const res = await request<{ success: boolean; message: string }>('/admin/test-send', {
        method: 'POST',
        body: JSON.stringify({ targetEmail: testEmailAddr }),
      });
      setTestResult(res);
      if (res.success) {
        showMsg('测试邮件已成功发出！');
      } else {
        showMsg(res.message, 'error');
      }
    } catch (err: unknown) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : '网络或服务异常' });
    } finally {
      setTestingSend(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden">
      {/* 消息提示浮层 */}
      {msg && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-150 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* 顶部二级导航 */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
            activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>系统概览</span>
        </button>

        <button
          onClick={() => setActiveTab('domains')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
            activeTab === 'domains' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>域名管理</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
            activeTab === 'users' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>用户与配额</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
            activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>发信通道 & 设置</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
            activeTab === 'logs' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>发信审计日志</span>
        </button>
      </div>

      {/* 页面主内容 */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {/* 1. 概览 */}
        {activeTab === 'overview' && overview && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 统计指标网格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">总注册用户</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{overview.totalUsers}</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">托管域名数</div>
                <div className="text-2xl font-black text-blue-600 mt-1">{overview.totalDomains}</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">活跃邮箱别名</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{overview.totalMailboxes}</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">今日流转邮件</div>
                <div className="text-2xl font-black text-amber-500 mt-1">{overview.todayEmails}</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">总邮件量</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{overview.totalEmails}</div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-xs text-slate-500 font-medium">系统总存储占用</div>
                <div className="text-xl font-bold text-slate-800 mt-1 truncate">
                  {formatBytes(overview.totalStorageBytes)}
                </div>
              </div>
            </div>

            {/* 运作流程图解卡片 (对应架构图) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-base text-slate-900 mb-1 flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span>Cloud Mail 运作流程架构</span>
              </h3>
              <p className="text-xs text-slate-500 mb-6">全栈运行于 Cloudflare 边缘计算与无服务器数据库平台</p>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    1
                  </div>
                  <div className="font-bold text-xs text-slate-800">外部发件人</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">向域名邮箱发信</div>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    2
                  </div>
                  <div className="font-bold text-xs text-slate-800">DNS / MX</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Cloudflare MX 解析</div>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    3
                  </div>
                  <div className="font-bold text-xs text-slate-800">Email Routing</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">CF 边缘收信路由</div>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    4
                  </div>
                  <div className="font-bold text-xs text-slate-800">Worker 处理</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">postal-mime 解析</div>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    5
                  </div>
                  <div className="font-bold text-xs text-slate-800">D1 / R2 存储</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">结构化持久化存储</div>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                    6
                  </div>
                  <div className="font-bold text-xs text-slate-800">Webmail 后台</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">现代 UI 即时展示</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. 域名管理 */}
        {activeTab === 'domains' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* 添加域名卡片 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>添加新的托管域名</span>
              </h3>
              <form onSubmit={handleAddDomain} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  placeholder="例如: yourdomain.com"
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={newDomainDesc}
                  onChange={(e) => setNewDomainDesc(e.target.value)}
                  placeholder="备注说明 (选填)"
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDomainDefault}
                      onChange={(e) => setNewDomainDefault(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>设为默认域名</span>
                  </label>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    添加域名
                  </button>
                </div>
              </form>
            </div>

            {/* 域名列表表格 */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800">已托管域名 ({domains.length})</h4>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-3.5">域名</th>
                    <th className="p-3.5">描述</th>
                    <th className="p-3.5">关联邮箱数</th>
                    <th className="p-3.5">默认注册</th>
                    <th className="p-3.5">状态</th>
                    <th className="p-3.5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {domains.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="p-3.5 font-mono font-bold text-slate-900">{d.domain_name}</td>
                      <td className="p-3.5 text-slate-500">{d.description || '-'}</td>
                      <td className="p-3.5 font-mono">{d.mailbox_count || 0}</td>
                      <td className="p-3.5">
                        {d.is_default === 1 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                            默认
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.is_active === 1
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {d.is_active === 1 ? '已激活' : '停用'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleShowDns(d.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          DNS 指南
                        </button>
                        <button
                          onClick={() => handleDeleteDomain(d.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="删除域名"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. 用户与配额管理 */}
        {activeTab === 'users' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="搜索用户名..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={loadUsers}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>刷新</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-3.5">用户名</th>
                    <th className="p-3.5">主邮箱</th>
                    <th className="p-3.5">角色</th>
                    <th className="p-3.5">别名数</th>
                    <th className="p-3.5">空间占用</th>
                    <th className="p-3.5">状态</th>
                    <th className="p-3.5 text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="p-3.5 font-bold text-slate-900">{u.username}</td>
                      <td className="p-3.5 font-mono text-slate-700">{u.primary_email || '-'}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.role === 'admin' ? '系统管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono">{u.mailbox_count || 0}</td>
                      <td className="p-3.5">
                        <span className="font-mono">
                          {formatBytes(u.used_bytes)} / {formatBytes(u.quota_bytes)}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {u.is_active === 1 ? '正常' : '已禁用'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setQuotaModal({
                              userId: u.id,
                              username: u.username,
                              currentMb: Math.round(u.quota_bytes / 1024 / 1024),
                            });
                            setNewQuotaMb(Math.round(u.quota_bytes / 1024 / 1024));
                          }}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
                          title="修改空间配额"
                        >
                          配额
                        </button>
                        <button
                          onClick={() => setResetPwdModal({ userId: u.id, username: u.username })}
                          className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
                          title="重置密码"
                        >
                          改密
                        </button>
                        <button
                          onClick={() => handleToggleUserRole(u.id, u.role)}
                          className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          {u.role === 'admin' ? '降为用户' : '升为管理'}
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                          className={`px-2 py-1 rounded ${
                            u.is_active === 1
                              ? 'text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {u.is_active === 1 ? '禁用' : '解禁'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 发信通道与系统设置 */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 发信通道配置 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Send className="w-5 h-5 text-blue-600" />
                <span>发信服务通道 (Outbound Mail Channel)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Cloudflare Workers 本身专注于入站收信。出站发信推荐无缝接入 <strong>Resend API</strong>（每月免费 3000 封，专为 Cloudflare 优化），也支持外部 SMTP 网关。
              </p>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    当前发信通道类型
                  </label>
                  <select
                    value={settings.send_channel || 'resend'}
                    onChange={(e) => setSettings({ ...settings, send_channel: e.target.value })}
                    className="w-full sm:w-64 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="resend">Resend API (推荐，高送达率，零运维)</option>
                    <option value="smtp">自定义 SMTP 网关</option>
                  </select>
                </div>

                {settings.send_channel === 'resend' || !settings.send_channel ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Resend API Key
                    </label>
                    <input
                      type="password"
                      value={settings.resend_api_key || ''}
                      onChange={(e) => setSettings({ ...settings, resend_api_key: e.target.value })}
                      placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="text-[11px] text-slate-400 mt-1">
                      可在 <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">resend.com</a> 免费获取 API Key，并在其控制台添加您的域名。
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={settings.smtp_host || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Port</label>
                      <input
                        type="text"
                        value={settings.smtp_port || '465'}
                        onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">SMTP User</label>
                      <input
                        type="text"
                        value={settings.smtp_user || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_user: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Password</label>
                      <input
                        type="password"
                        value={settings.smtp_pass || ''}
                        onChange={(e) => setSettings({ ...settings, smtp_pass: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">设置将保存在 Cloudflare D1 settings 表中</span>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm"
                  >
                    保存配置
                  </button>
                </div>
              </form>
            </div>

            {/* 在线测试发信 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>在线连通性测试发信</span>
              </h3>
              <p className="text-xs text-slate-500">
                向任意外部邮箱（如您的个人 QQ/Gmail 邮箱）发送一封测试邮件，实时验证发信服务状态。
              </p>

              <div className="flex space-x-2">
                <input
                  type="email"
                  value={testEmailAddr}
                  onChange={(e) => setTestEmailAddr(e.target.value)}
                  placeholder="请输入您的测试收件邮箱，例如 your_gmail@gmail.com"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={testingSend}
                  onClick={handleTestSend}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
                >
                  {testingSend ? '正在测试投递...' : '立即测试发信'}
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-xl border text-xs leading-relaxed ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="font-bold mb-1">
                    {testResult.success ? '✅ 测试发信成功' : '❌ 发信测试未通过'}
                  </div>
                  <div>{testResult.message}</div>
                </div>
              )}
            </div>

            {/* 用户注册与默认容量策略 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900">用户注册与空间配额策略</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">自主注册开关</label>
                  <select
                    value={settings.allow_registration || 'true'}
                    onChange={(e) => setSettings({ ...settings, allow_registration: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="true">允许新用户自由注册</option>
                    <option value="false">仅限管理员后台分配</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">新用户默认配额 (MB)</label>
                  <input
                    type="number"
                    value={settings.default_quota_mb || '500'}
                    onChange={(e) => setSettings({ ...settings, default_quota_mb: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">普通用户别名上限</label>
                  <input
                    type="number"
                    value={settings.max_mailboxes_per_user || '5'}
                    onChange={(e) => setSettings({ ...settings, max_mailboxes_per_user: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm"
                >
                  保存策略
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. 发信日志 */}
        {activeTab === 'logs' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800">发信审计日志 ({logs.length})</h4>
                <button
                  onClick={loadLogs}
                  className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>刷新日志</span>
                </button>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="p-3.5">发信时间</th>
                    <th className="p-3.5">操作用户</th>
                    <th className="p-3.5">发件人</th>
                    <th className="p-3.5">收件人</th>
                    <th className="p-3.5">主题</th>
                    <th className="p-3.5">通道</th>
                    <th className="p-3.5">投递状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        暂无发信记录
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="p-3.5 font-mono text-slate-400">{formatFullDate(log.created_at)}</td>
                        <td className="p-3.5 font-bold text-slate-700">{log.username || '-'}</td>
                        <td className="p-3.5 font-mono">{log.from_address}</td>
                        <td className="p-3.5 font-mono text-slate-700 truncate max-w-[200px]" title={log.to_addresses}>
                          {log.to_addresses}
                        </td>
                        <td className="p-3.5 text-slate-800 font-medium truncate max-w-[200px]" title={log.subject}>
                          {log.subject}
                        </td>
                        <td className="p-3.5 uppercase font-mono text-slate-500">{log.channel}</td>
                        <td className="p-3.5">
                          {log.status === 'success' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              成功
                            </span>
                          ) : (
                            <span
                              className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px] cursor-help"
                              title={log.error_message || '发送失败'}
                            >
                              失败
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DNS 指南模态框 */}
      {selectedDnsDomain && (
        <DnsGuideModal
          domain={selectedDnsDomain.domain}
          records={selectedDnsDomain.records}
          onClose={() => setSelectedDnsDomain(null)}
        />
      )}

      {/* 重置密码模态框 */}
      {resetPwdModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-2">重置用户密码</h3>
            <p className="text-xs text-slate-500 mb-4">
              为用户 <strong className="text-slate-800">{resetPwdModal.username}</strong> 设置新的登录密码。
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="password"
                required
                minLength={6}
                value={newPasswordForUser}
                onChange={(e) => setNewPasswordForUser(e.target.value)}
                placeholder="请输入新密码 (至少 6 位)"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPwdModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  确认重置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 修改配额模态框 */}
      {quotaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-800 mb-2">调整用户空间配额</h3>
            <p className="text-xs text-slate-500 mb-4">
              设置用户 <strong className="text-slate-800">{quotaModal.username}</strong> 的最大邮箱容量大小。
            </p>

            <form onSubmit={handleUpdateQuota} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">容量配额 (MB)</label>
                <input
                  type="number"
                  required
                  min={10}
                  value={newQuotaMb}
                  onChange={(e) => setNewQuotaMb(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuotaModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  保存配额
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
