// frontend/src/App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { request } from './lib/api';
import { Navbar } from './components/Navbar';
import { Auth } from './pages/Auth';
import { MailboxView } from './pages/MailboxView';
import { AdminView } from './pages/AdminView';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cfmail_token'));
  const [activeView, setActiveView] = useState<'mailbox' | 'admin'>('mailbox');
  const [loading, setLoading] = useState(true);

  // 加载当前登录用户详情
  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('cfmail_token')) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await request<User>('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth-expired', handleExpired);
    return () => window.removeEventListener('auth-expired', handleExpired);
  }, [refreshUser]);

  const handleLoginSuccess = (loginUser: User, newToken: string) => {
    setUser(loginUser);
    setToken(newToken);
    setActiveView('mailbox');
    refreshUser();
  };

  const handleLogout = () => {
    localStorage.removeItem('cfmail_token');
    localStorage.removeItem('cfmail_user');
    setUser(null);
    setToken(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-slate-300">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium tracking-wide">加载 Cloud Mail 系统中...</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return <Auth onSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        user={user}
        activeView={activeView}
        onViewChange={setActiveView}
        onLogout={handleLogout}
        onUserUpdate={refreshUser}
      />

      {activeView === 'admin' && user.role === 'admin' ? (
        <AdminView />
      ) : (
        <MailboxView user={user} onRefreshUser={refreshUser} />
      )}
    </div>
  );
};
export default App;
