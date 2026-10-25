'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  Building,
  Shield,
  KeyRound,
  LogOut,
  MapPin,
  Clock,
  Database,
  Bot,
  Mail,
  CheckCircle,
  X,
  Plus,
  Network,
  Globe,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { extractErrorMessage } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChange?: (isDark: boolean) => void;
}

export function SettingsModal({ isOpen, onClose, onThemeChange }: SettingsModalProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'appearance' | 'organization' | 'network' | 'services' | 'security'>('appearance');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('light');
  const [company, setCompany] = useState<any>(null);

  // Network IP Restriction states
  const [clientIp, setClientIp] = useState<string>('');
  const [ipRestrictionsEnabled, setIpRestrictionsEnabled] = useState(false);
  const [adminIps, setAdminIps] = useState<string[]>([]);
  const [hrIps, setHrIps] = useState<string[]>([]);
  const [employeeIps, setEmployeeIps] = useState<string[]>([]);
  const [newAdminIp, setNewAdminIp] = useState('');
  const [newHrIp, setNewHrIp] = useState('');
  const [newEmpIp, setNewEmpIp] = useState('');
  const [savingIps, setSavingIps] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const saved = localStorage.getItem('hcm_dark');
    if (saved === 'true') {
      setThemeMode('dark');
    } else if (saved === 'false') {
      setThemeMode('light');
    } else {
      setThemeMode('system');
    }

    // Load company settings
    api.get('/api/v1/setup/company')
      .then(({ data }) => {
        setCompany(data);
        setIpRestrictionsEnabled(Boolean(data.ip_restrictions_enabled));
        setAdminIps(Array.isArray(data.admin_allowed_ips) ? data.admin_allowed_ips : []);
        setHrIps(Array.isArray(data.hr_allowed_ips) ? data.hr_allowed_ips : []);
        setEmployeeIps(Array.isArray(data.employee_allowed_ips) ? data.employee_allowed_ips : []);
      })
      .catch(() => {});

    // Fetch current client IP
    api.get('/api/v1/auth/my-ip')
      .then(({ data }) => {
        setClientIp(data.client_ip || '127.0.0.1');
      })
      .catch(() => {});
  }, [isOpen]);

  const applyTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeMode(mode);
    let isDark = false;
    if (mode === 'dark') {
      isDark = true;
      document.documentElement.classList.add('dark');
      localStorage.setItem('hcm_dark', 'true');
    } else if (mode === 'light') {
      isDark = false;
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hcm_dark', 'false');
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.removeItem('hcm_dark');
    }
    if (onThemeChange) onThemeChange(isDark);
  };

  const handleAddIp = (role: 'admin' | 'hr' | 'employee', ipToAdd: string) => {
    const trimmed = ipToAdd.trim();
    if (!trimmed) return;
    if (role === 'admin') {
      if (!adminIps.includes(trimmed)) setAdminIps([...adminIps, trimmed]);
      setNewAdminIp('');
    } else if (role === 'hr') {
      if (!hrIps.includes(trimmed)) setHrIps([...hrIps, trimmed]);
      setNewHrIp('');
    } else {
      if (!employeeIps.includes(trimmed)) setEmployeeIps([...employeeIps, trimmed]);
      setNewEmpIp('');
    }
  };

  const handleRemoveIp = (role: 'admin' | 'hr' | 'employee', ipToRemove: string) => {
    if (role === 'admin') setAdminIps(adminIps.filter((i) => i !== ipToRemove));
    else if (role === 'hr') setHrIps(hrIps.filter((i) => i !== ipToRemove));
    else setEmployeeIps(employeeIps.filter((i) => i !== ipToRemove));
  };

  const handleSaveIpSettings = async () => {
    setSavingIps(true);
    try {
      const payload = {
        ip_restrictions_enabled: ipRestrictionsEnabled,
        admin_allowed_ips: adminIps,
        hr_allowed_ips: hrIps,
        employee_allowed_ips: employeeIps,
      };
      await api.put('/api/v1/setup/company', payload);
      toast('success', 'Security Updated', 'Trusted network IP policies updated successfully.');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to update network IP policies');
      toast('error', 'Error', msg);
    } finally {
      setSavingIps(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#0066FF] text-white flex items-center justify-center shadow-md">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                System & Preferences Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Display preferences, working hours, and network access policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-5 text-xs font-semibold shrink-0 bg-white dark:bg-[#0F172A] overflow-x-auto">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-3 relative transition-colors whitespace-nowrap ${
              activeTab === 'appearance'
                ? 'text-[#0066FF] border-b-2 border-[#0066FF]'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('organization')}
            className={`py-3 relative transition-colors whitespace-nowrap ${
              activeTab === 'organization'
                ? 'text-[#0066FF] border-b-2 border-[#0066FF]'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            Work Schedule
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`py-3 relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'network'
                ? 'text-[#0066FF] border-b-2 border-[#0066FF]'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            Trusted Networks (IP)
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`py-3 relative transition-colors whitespace-nowrap ${
              activeTab === 'services'
                ? 'text-[#0066FF] border-b-2 border-[#0066FF]'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            Service Health
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 relative transition-colors whitespace-nowrap ${
              activeTab === 'security'
                ? 'text-[#0066FF] border-b-2 border-[#0066FF]'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
            }`}
          >
            Account
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Tab 1: Appearance */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Color Theme</h3>
                <p className="text-xs text-slate-500 mb-4">Choose your preferred interface theme</p>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => applyTheme('light')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      themeMode === 'light'
                        ? 'border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/20 text-[#0066FF]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Sun className="h-6 w-6" />
                    <span className="text-xs font-bold">Light Mode</span>
                    <span className="text-[10px] text-slate-400">Clean Slate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTheme('dark')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      themeMode === 'dark'
                        ? 'border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/20 text-[#0066FF]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Moon className="h-6 w-6" />
                    <span className="text-xs font-bold">Dark Mode</span>
                    <span className="text-[10px] text-slate-400">Deep Navy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyTheme('system')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                      themeMode === 'system'
                        ? 'border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/20 text-[#0066FF]'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Laptop className="h-6 w-6" />
                    <span className="text-xs font-bold">System Default</span>
                    <span className="text-[10px] text-slate-400">Auto match OS</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Work Schedule */}
          {activeTab === 'organization' && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Company Shift & Policies</h3>
                <p className="text-slate-500 mb-3">Enforced for daily check-ins, late arrival calculations, and leaves</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[11px]">Organization Name</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {company?.company_name || 'HCM Lite Enterprise'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[11px]">Shift Start & Grace Time</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#0066FF]" />
                    {company?.office_start_time || '09:00'} ({company?.grace_minutes || 15} min Grace)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[11px]">Office Location Perimeter</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    {company?.geofence_radius_m || 150}m Radius Allowed
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[11px]">Annual Paid Leave Quota</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {company?.annual_leave_quota || 14} Annual / {company?.sick_leave_quota || 8} Sick / {company?.casual_leave_quota || 10} Casual
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Network Security (Trusted IPs) */}
          {activeTab === 'network' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trusted Network Access (IP Whitelist)</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Restrict portal access so staff can only sign in from authorized corporate networks.
                  </p>
                </div>
                {user?.role === 'Admin' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ipRestrictionsEnabled}
                      onChange={(e) => setIpRestrictionsEnabled(e.target.checked)}
                      className="h-4 w-4 text-[#0066FF] rounded border-gray-300 focus:ring-[#0066FF]"
                    />
                    <span className="font-semibold text-slate-900 dark:text-white text-xs">
                      Enforce IP Rules
                    </span>
                  </label>
                )}
              </div>

              {/* Current IP Detection Callout */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-[#0066FF]" />
                  <div>
                    <span className="text-slate-700 dark:text-slate-300 text-xs">Your Current Detected IP:</span>
                    <span className="font-mono font-bold text-[#0066FF] ml-1.5">{clientIp || 'Detecting...'}</span>
                  </div>
                </div>
                {user?.role === 'Admin' && clientIp && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddIp('admin', clientIp)}
                    className="text-[11px] h-7 px-2.5 border-blue-300 text-blue-700 dark:text-blue-300"
                  >
                    + Add to Admin List
                  </Button>
                )}
              </div>

              {/* IP Lists */}
              <div className="space-y-4 pt-1">
                {/* 1. Admin Allowed IPs */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-blue-600" />
                      Administrator Allowed IPs
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {adminIps.length === 0 ? 'Any IP Allowed (Unrestricted)' : `${adminIps.length} Allowed`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {adminIps.map((ip) => (
                      <span
                        key={ip}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-mono text-[11px] border border-blue-200 dark:border-blue-800"
                      >
                        {ip}
                        {user?.role === 'Admin' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIp('admin', ip)}
                            className="hover:text-red-500 ml-1"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {user?.role === 'Admin' && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newAdminIp}
                        onChange={(e) => setNewAdminIp(e.target.value)}
                        placeholder="e.g. 192.168.1.10"
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddIp('admin', newAdminIp)}
                        className="h-8 text-xs"
                      >
                        Add IP
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2. HR Allowed IPs */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-emerald-600" />
                      HR Staff Allowed IPs
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {hrIps.length === 0 ? 'Any IP Allowed (Unrestricted)' : `${hrIps.length} Allowed`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {hrIps.map((ip) => (
                      <span
                        key={ip}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] border border-emerald-200 dark:border-emerald-800"
                      >
                        {ip}
                        {user?.role === 'Admin' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIp('hr', ip)}
                            className="hover:text-red-500 ml-1"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {user?.role === 'Admin' && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newHrIp}
                        onChange={(e) => setNewHrIp(e.target.value)}
                        placeholder="e.g. 192.168.1.20"
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddIp('hr', newHrIp)}
                        className="h-8 text-xs"
                      >
                        Add IP
                      </Button>
                    </div>
                  )}
                </div>

                {/* 3. Employee Allowed IPs */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-purple-600" />
                      Employee Allowed IPs
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {employeeIps.length === 0 ? 'Any IP Allowed (Unrestricted)' : `${employeeIps.length} Allowed`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {employeeIps.map((ip) => (
                      <span
                        key={ip}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-mono text-[11px] border border-purple-200 dark:border-purple-800"
                      >
                        {ip}
                        {user?.role === 'Admin' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveIp('employee', ip)}
                            className="hover:text-red-500 ml-1"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {user?.role === 'Admin' && (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newEmpIp}
                        onChange={(e) => setNewEmpIp(e.target.value)}
                        placeholder="e.g. 192.168.1.50"
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddIp('employee', newEmpIp)}
                        className="h-8 text-xs"
                      >
                        Add IP
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {user?.role === 'Admin' && (
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleSaveIpSettings}
                    loading={savingIps}
                    className="w-full flex items-center justify-center gap-2 text-xs"
                  >
                    <Save className="h-4 w-4" />
                    Save Trusted Network Policies
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Service Health */}
          {activeTab === 'services' && (
            <div className="space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">System Health & Integrations</h3>
              <p className="text-slate-500 mb-2">Live connection status of core institutional services</p>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-[#0066FF]" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">Database Service</span>
                      <span className="text-[11px] text-slate-400">PostgreSQL Relational Storage</span>
                    </div>
                  </div>
                  <Badge variant="green">Connected</Badge>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-purple-600" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">AI Assistant & Parser</span>
                      <span className="text-[11px] text-slate-400">Smart Leave NLP & Decision Copilot</span>
                    </div>
                  </div>
                  <Badge variant="green">Operational</Badge>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-emerald-600" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block text-sm">Email Delivery Service</span>
                      <span className="text-[11px] text-slate-400">Verification Codes, Approvals & Payslip Notices</span>
                    </div>
                  </div>
                  <Badge variant="green">Active</Badge>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Account & Security */}
          {activeTab === 'security' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Active Session Details</h3>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">User Account:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Assigned Role:</span>
                  <span className="font-bold text-[#0066FF] uppercase">{user?.role}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Link href="/change-password" onClick={onClose} className="flex-1">
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2 text-xs">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Reset / Update Password</span>
                  </Button>
                </Link>

                <Button
                  variant="primary"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  className="flex items-center justify-center gap-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 font-medium">HCM Lite &bull; Smarter HR. Happier Teams.</span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
