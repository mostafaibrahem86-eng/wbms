'use client';

import { useEffect, useRef } from 'react';
import { useAppStore, type ModuleType } from '@/lib/store';
import { apiFetch } from '@/lib/apiFetch';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Megaphone,
  Zap,
  FileText,
  UserCog,
  Settings,
  LogOut,
  X,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  id: ModuleType;
  label: string;
  icon: React.ReactNode;
  section: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, section: 'MAIN' },
  { id: 'inbox', label: 'Inbox', icon: <MessageSquare className="w-5 h-5" />, section: 'MAIN' },
  { id: 'contacts', label: 'Contacts', icon: <Users className="w-5 h-5" />, section: 'MAIN' },
  { id: 'campaigns', label: 'Campaigns', icon: <Megaphone className="w-5 h-5" />, section: 'MARKETING' },
  { id: 'automation', label: 'Automation', icon: <Zap className="w-5 h-5" />, section: 'MARKETING' },
  { id: 'templates', label: 'Templates', icon: <FileText className="w-5 h-5" />, section: 'MARKETING' },
  { id: 'users', label: 'Users', icon: <UserCog className="w-5 h-5" />, section: 'SYSTEM', adminOnly: true },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" />, section: 'SYSTEM', adminOnly: true },
];

const sections = ['MAIN', 'MARKETING', 'SYSTEM'];

interface SidebarProps {
  onLogout: () => void;
}

export default function Sidebar({ onLogout }: SidebarProps) {
  const { activeModule, setActiveModule, sidebarOpen, setSidebarOpen, user, unreadCount, isAuthenticated, setUnreadCount } = useAppStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll unread count every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const fetchUnread = async () => {
      try {
        const res = await apiFetch('/api/stats/unread');
        if (res.ok) {
          const data = await res.json();
          if (typeof data.unreadCount === 'number') {
            setUnreadCount(data.unreadCount);
          }
        }
      } catch {
        // silently ignore
      }
    };

    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isAuthenticated, setUnreadCount]);

  const handleNav = (id: ModuleType) => {
    setActiveModule(id);
    setSidebarOpen(false);
  };

  const filteredNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-whatsapp rounded-xl flex items-center justify-center shadow-md">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">WBMS</h1>
            <p className="text-gray-400 text-xs">WhatsApp Business</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <Separator className="bg-gray-700" />

      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        {sections.map((section) => {
          const sectionItems = filteredNav.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;

          return (
            <div key={section} className="mb-1">
              <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {section}
              </p>
              {sectionItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  onClick={() => handleNav(item.id)}
                  className={`w-full justify-start gap-3 px-5 py-2.5 h-auto text-sm font-medium transition-colors ${
                    activeModule === item.id
                      ? 'bg-whatsapp/15 text-whatsapp border-r-[3px] border-r-whatsapp rounded-none hover:bg-whatsapp/25'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/50 rounded-none'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'inbox' && unreadCount > 0 && (
                    <span className="bg-whatsapp text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          );
        })}
      </nav>

      <Separator className="bg-gray-700" />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center text-whatsapp font-bold text-sm">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-gray-400 text-[10px] capitalize">{user?.role || ''}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start gap-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 shrink-0 bg-gray-900 h-screen sticky top-0 sidebar-transition">
        {sidebarContent}
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900 z-50 lg:hidden sidebar-transition shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
