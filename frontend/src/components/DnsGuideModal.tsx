// frontend/src/components/DnsGuideModal.tsx
import React, { useState } from 'react';
import { X, Copy, Check, Globe, HelpCircle, ExternalLink } from 'lucide-react';

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
  purpose: string;
}

interface DnsGuideModalProps {
  domain: string;
  records: DnsRecord[];
  onClose: () => void;
}

export const DnsGuideModal: React.FC<DnsGuideModalProps> = ({
  domain,
  records,
  onClose,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-base">DNS 解析配置指南：{domain}</h3>
              <p className="text-xs text-slate-400">将下列记录添加到 Cloudflare 域名控制台的 DNS 区域中</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* 提示步骤 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
            <div className="font-semibold flex items-center space-x-1.5">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Cloudflare Email Routing 接入指引步骤</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              <li>登录 <strong>Cloudflare Dashboard</strong>，进入域名 <code>{domain}</code>；</li>
              <li>在左侧菜单点击 <strong>电子邮件 (Email Routing)</strong>，若未开启请点击开启，Cloudflare 会自动推荐添加 MX 记录；</li>
              <li>在 <strong>路由规则 (Routing Rules)</strong> 中：
                添加自定义地址或 Catch-all 规则，动作选择 <strong>发送到 Worker (Send to Worker)</strong>，目标选择本项目部署的 Worker 名称即可！
              </li>
              <li>在 <strong>DNS 记录</strong> 中，确保下列 MX、SPF、DMARC 记录全部配置妥当以保证发信送达率。</li>
            </ol>
          </div>

          {/* 表格 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3 w-16">类型</th>
                  <th className="p-3 w-28">主机名 (Name)</th>
                  <th className="p-3">记录值 (Value / Content)</th>
                  <th className="p-3 w-16">优先级</th>
                  <th className="p-3 w-16 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-semibold text-blue-600">{rec.type}</td>
                    <td className="p-3 font-mono text-slate-700">{rec.name}</td>
                    <td className="p-3">
                      <div className="font-mono text-slate-900 break-all select-all bg-slate-50 p-1.5 rounded border border-slate-200">
                        {rec.value}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">{rec.purpose}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {rec.priority !== undefined ? rec.priority : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => copyToClipboard(rec.value, idx)}
                        title="复制记录值"
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors"
          >
            我已了解
          </button>
        </div>
      </div>
    </div>
  );
};
