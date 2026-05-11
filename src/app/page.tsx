'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { apiFetch, getToken, setToken, removeToken } from '@/lib/apiFetch';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Sidebar from '@/components/wbms/Sidebar';
import LoginPage from '@/components/wbms/LoginPage';
import Dashboard from '@/components/wbms/Dashboard';
import ContactsTable from '@/components/wbms/ContactsTable';
import Inbox from '@/components/wbms/Inbox';
import CampaignsList from '@/components/wbms/CampaignsList';
import AutomationRules from '@/components/wbms/AutomationRules';
import TemplatesManager from '@/components/wbms/TemplatesManager';
import UsersManager from '@/components/wbms/UsersManager';
import Settings from '@/components/wbms/Settings';

export default function Home() {
  const {
    isAuthenticated,
    isLoading,
    user,
    activeModule,
    setAuthenticated,
    setUser,
    setLoading,
    logout: storeLogout,
    sidebarOpen,
    toggleSidebar,
  } = useAppStore();

  const checkDone = useRef(false);

  // Check auth on mount — with safety timeout
  useEffect(() => {
    if (checkDone.current) return;
    checkDone.current = true;

    const timeout = setTimeout(() => {
      // Safety: force loading to false after 5 seconds
      setLoading(false);
    }, 5000);

    checkAuth().finally(() => clearTimeout(timeout));
  }, []);

  const checkAuth = async () => {
    try {
      const token = getToken();
      if (!token) {
        setAuthenticated(false);
        setUser(null);
        setLoading(false);
        return;
      }

      // Use AbortController for additional safety
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await apiFetch('/api/auth/me', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true);
        setUser(data.user || data);

        // Fetch unread count for sidebar badge (non-blocking)
        apiFetch('/api/stats/unread')
          .then((unreadRes) => {
            if (unreadRes.ok) return unreadRes.json();
            return null;
          })
          .then((unreadData) => {
            if (unreadData && typeof unreadData.unreadCount === 'number') {
              useAppStore.getState().setUnreadCount(unreadData.unreadCount);
            }
          })
          .catch(() => {});
      } else {
        removeToken();
        setAuthenticated(false);
        setUser(null);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (_userData: { id: string; email: string; name: string; role: string }, token?: string) => {
    if (token) {
      setToken(token);
    }
    setAuthenticated(true);
    setUser(_userData);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore
    }
    removeToken();
    storeLogout();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.12 1.52 5.856L0 24l6.336-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.984 0-3.827-.546-5.407-1.494l-.388-.231-3.76.988.998-3.648-.253-.404A9.776 9.776 0 012.18 12c0-5.422 4.398-9.82 9.82-9.82 5.422 0 9.82 4.398 9.82 9.82 0 5.422-4.398 9.82-9.82 9.82z"/>
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Render active module
  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <Dashboard />;
      case 'inbox':
        return <Inbox />;
      case 'contacts':
        return <ContactsTable />;
      case 'campaigns':
        return <CampaignsList />;
      case 'automation':
        return <AutomationRules />;
      case 'templates':
        return <TemplatesManager />;
      case 'users':
        return user?.role === 'admin' ? <UsersManager /> : <Dashboard />;
      case 'settings':
        return user?.role === 'admin' ? <Settings /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center gap-3 p-4 bg-white border-b shadow-sm">
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.12 1.52 5.856L0 24l6.336-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82c-1.984 0-3.827-.546-5.407-1.494l-.388-.231-3.76.988.998-3.648-.253-.404A9.776 9.776 0 012.18 12c0-5.422 4.398-9.82 9.82-9.82 5.422 0 9.82 4.398 9.82 9.82 0 5.422-4.398 9.82-9.82 9.82z"/>
              </svg>
            </div>
            <span className="font-bold text-gray-900">WBMS</span>
          </div>
        </header>

        {/* Module Content */}
        <div className={`flex-1 ${activeModule === 'inbox' ? 'overflow-hidden' : 'overflow-y-auto p-4 md:p-6'}`}>
          {renderModule()}
        </div>
      </main>
    </div>
  );
}
