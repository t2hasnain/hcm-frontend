'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  User,
  ChevronDown,
  Settings,
  CheckCheck,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { SettingsModal } from '@/components/layout/SettingsModal';

interface NavbarProps {
  onMobileMenuOpen: () => void;
}

interface Notification {
  id: number;
  title: string;
  message?: string;
  body?: string;
  is_read: boolean;
  created_at: string;
}

export function Navbar({ onMobileMenuOpen }: NavbarProps) {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [companyName, setCompanyName] = useState('HCM Lite');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hcm_dark');
    if (saved === 'true') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  const fetchNotifications = () => {
    api.get('/api/v1/comms/notifications').then(({ data }) => {
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setNotifications(list);
    }).catch(() => {});
  };

  useEffect(() => {
    api.get('/api/v1/setup/company').then(({ data }) => {
      setCompanyName(data.company_name || 'HCM Lite');
    }).catch(() => {});
    fetchNotifications();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hcm_dark', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hcm_dark', 'false');
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/v1/comms/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const markOneRead = async (id: number) => {
    try {
      await api.put(`/api/v1/comms/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {}
  };

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !n.is_read).length;

  return (
    <header className="relative z-40 h-14 shrink-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3">
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Company name / Mobile Logo */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="lg:hidden">
          <BrandLogo variant="icon" size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{companyName}</span>
          {user?.role && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0066FF]/10 text-[#0066FF] dark:bg-[#0066FF]/20 border border-[#0066FF]/20 uppercase tracking-wider">
              {user.role}
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode */}
        <button
          onClick={toggleDark}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Toggle dark mode"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = !notifOpen;
              setNotifOpen(next);
              if (next) fetchNotifications();
            }}
            className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-88 md:w-96 bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Notifications</p>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0066FF] text-white">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[#0066FF] hover:underline font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/80 flex-1">
                {safeNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">No notifications yet</p>
                  </div>
                ) : (
                  safeNotifications.slice(0, 15).map((n) => {
                    const isApproved = n.title.toLowerCase().includes('approved');
                    const isRejected = n.title.toLowerCase().includes('rejected');
                    return (
                      <div
                        key={n.id}
                        onClick={() => markOneRead(n.id)}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-3 ${
                          !n.is_read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isApproved ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : isRejected ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Info className="h-4 w-4 text-[#0066FF]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                              {n.title}
                            </p>
                            {!n.is_read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#0066FF] shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message || n.body || ''}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="System & Preferences Settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-gray-900 dark:text-white leading-tight">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{user?.role}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-medium text-gray-900 dark:text-white">{user?.full_name || user?.email}</p>
                <p className="text-xs text-gray-400">{user?.role}</p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); setSettingsOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
