'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  ScrollText,
  UserCheck,
  CalendarClock,
  User,
  Clock,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BrandLogo } from '@/components/ui/BrandLogo';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Organization', href: '/admin/organization', icon: <Building2 className="h-5 w-5" /> },
  { label: 'Users', href: '/admin/users', icon: <Users className="h-5 w-5" /> },
  { label: 'Payroll', href: '/admin/payroll', icon: <CreditCard className="h-5 w-5" /> },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: <ScrollText className="h-5 w-5" /> },
];

const hrNav: NavItem[] = [
  { label: 'Dashboard', href: '/hr', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'Employees', href: '/hr/employees', icon: <Users className="h-5 w-5" /> },
  { label: 'Approvals', href: '/hr/approvals', icon: <UserCheck className="h-5 w-5" /> },
  { label: 'Payroll', href: '/hr/payroll', icon: <CreditCard className="h-5 w-5" /> },
];

const employeeNav: NavItem[] = [
  { label: 'Dashboard', href: '/employee', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'My Attendance', href: '/employee/attendance', icon: <Clock className="h-5 w-5" /> },
  { label: 'Smart Leave', href: '/employee/leave', icon: <Sparkles className="h-5 w-5" /> },
  { label: 'My Payslips', href: '/employee/payslips', icon: <CreditCard className="h-5 w-5" /> },
  { label: 'My Profile', href: '/employee/profile', icon: <User className="h-5 w-5" /> },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();

  const navItems =
    user?.role === 'Admin'
      ? adminNav
      : user?.role === 'HR'
      ? hrNav
      : employeeNav;

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/hr' || href === '/employee') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center px-4 py-4 border-b border-gray-200 dark:border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <BrandLogo variant={collapsed ? 'icon' : 'full'} size="md" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onMobileClose}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive(item.href)
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? item.label : undefined}
          >
            {item.icon}
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* User info at bottom */}
      {!collapsed && (
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="hidden lg:flex items-center justify-center p-3 border-t border-gray-200 dark:border-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={onMobileClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 lg:hidden">
            <button
              onClick={onMobileClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
