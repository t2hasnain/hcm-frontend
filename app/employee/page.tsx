'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Calendar,
  CheckCircle,
  LogOut,
  Sparkles,
  Download,
  AlertCircle,
  Bell,
  RefreshCw,
  Camera,
  MapPin,
  FileText,
  ChevronRight,
  TrendingUp,
  User,
  ShieldCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, getStatusColor, extractErrorMessage } from '@/lib/utils';
import { CameraAttendanceModal } from '@/components/employee/CameraAttendanceModal';

interface DashboardTelemetry {
  employee_id: number;
  employee_code: string;
  full_name: string;
  today_attendance: {
    checked_in: boolean;
    status: string | null;
    check_in: string | null;
    check_out: string | null;
  };
  month_summary: {
    present: number;
    late: number;
    half_day: number;
    total_hours: number;
  };
  leave_balance: {
    annual: { quota: number; used: number; remaining: number };
    sick: { quota: number; used: number; remaining: number };
    casual: { quota: number; used: number; remaining: number };
  };
  pending_leave_requests: number;
  unread_notifications: number;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: string;
  created_at: string;
}

interface RecentPayslip {
  id: number;
  month: string;
  gross_salary: number;
  net_salary: number;
  deductions: number;
}

export default function EmployeeDashboardPage() {
  const [telemetry, setTelemetry] = useState<DashboardTelemetry | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [latestPayslip, setLatestPayslip] = useState<RecentPayslip | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Camera Modal
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  // Web check in/out loading
  const [attLoading, setAttLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [resDash, resAtt, resAnn, resComp] = await Promise.all([
        api.get('/api/v1/analytics/employee'),
        api.get('/api/v1/attendance?limit=5'),
        api.get('/api/v1/comms/announcements').catch(() => ({ data: [] })),
        api.get('/api/v1/setup/company').catch(() => ({ data: null })),
      ]);

      setTelemetry(resDash.data);
      const attList = Array.isArray(resAtt.data?.items)
        ? resAtt.data.items
        : Array.isArray(resAtt.data)
        ? resAtt.data
        : [];
      setHistory(attList);
      const rawAnn = resAnn.data;
      const annList = Array.isArray(rawAnn?.items)
        ? rawAnn.items
        : Array.isArray(rawAnn)
        ? rawAnn
        : [];
      setAnnouncements(annList);
      setCompanySettings(resComp.data);

      // Load 360 profile for latest payslip
      if (resDash.data?.employee_id) {
        try {
          const res360 = await api.get(`/api/v1/employees/${resDash.data.employee_id}/360`);
          const slips = res360.data?.recent_payslips || [];
          if (slips.length > 0) {
            setLatestPayslip(slips[0]);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to load employee dashboard', err);
      setErrorMsg('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleWebCheckIn = async () => {
    setAttLoading(true);
    setErrorMsg('');
    try {
      await api.post('/api/v1/attendance/check-in', { source: 'web' });
      setSuccessMsg('Checked in successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Web check-in failed'));
    } finally {
      setAttLoading(false);
    }
  };

  const handleWebCheckOut = async () => {
    setAttLoading(true);
    setErrorMsg('');
    try {
      await api.post('/api/v1/attendance/check-out', {});
      setSuccessMsg('Checked out successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Web check-out failed'));
    } finally {
      setAttLoading(false);
    }
  };

  const handleDownloadPayslip = async (payslipId: number, month: string) => {
    try {
      const res = await api.get(`/api/v1/payroll/payslips/${payslipId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payslip_${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: unknown) {
      alert(extractErrorMessage(err, 'Failed to download payslip PDF'));
    }
  };

  if (isLoading && !telemetry) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <span className="text-sm text-gray-500">Loading your employee portal...</span>
      </div>
    );
  }

  const todayAtt = telemetry?.today_attendance;
  const isCheckedIn = !!todayAtt?.checked_in;
  const isCheckedOut = !!todayAtt?.check_out;

  // Real live weekly hours calculated from recorded attendance records
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayDate = new Date(now);
  mondayDate.setDate(now.getDate() + mondayOffset);
  mondayDate.setHours(0, 0, 0, 0);

  const thisWeekCompletedHours = history
    .filter((h: any) => new Date(h.date) >= mondayDate)
    .reduce((acc: number, curr: any) => acc + (Number(curr.work_hours) || 0), 0);

  let liveTodayHours = 0;
  if (isCheckedIn && !isCheckedOut && todayAtt?.check_in) {
    const startMs = new Date(todayAtt.check_in).getTime();
    liveTodayHours = Math.max(0, (Date.now() - startMs) / 3600000);
  }

  const weeklyHours = Math.round((thisWeekCompletedHours + liveTodayHours) * 10) / 10;
  const weeklyPercentage = Math.min(100, Math.round((weeklyHours / 40) * 100));

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 flex items-center justify-center pointer-events-none">
          <Clock className="w-64 h-64 -mr-16" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-md">
                Employee Self-Service
              </span>
              <span className="text-xs text-blue-100 font-mono">{telemetry?.employee_code}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {telemetry?.full_name || 'Team Member'}
            </h1>
            <p className="text-sm text-blue-100 mt-1 max-w-xl">
              Log daily shifts, track quota balances, submit AI-assisted leave applications, and access PDF payslips.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/employee/leave">
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xs flex items-center gap-2 text-xs"
              >
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <span>Smart Leave</span>
              </Button>
            </Link>
            <Link href="/employee/attendance">
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xs flex items-center gap-2 text-xs"
              >
                <Calendar className="h-4 w-4" />
                <span>Attendance Log</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-200 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Check-In / Check-Out Command Center */}
      <Card className="border-blue-100 dark:border-blue-900/50 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Status block */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Today's Shift Status</span>
              {isCheckedIn ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Checked In ({todayAtt?.status === 'late' ? 'Late Arrival' : 'On-Time'})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  <span className="h-2 w-2 rounded-full bg-gray-400" />
                  Not Checked In
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {isCheckedIn
                  ? isCheckedOut
                    ? 'Shift Finished'
                    : `Active Shift (${todayAtt?.status === 'late' ? 'Late' : 'Present'})`
                  : 'Ready to Check In'}
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isCheckedIn
                ? `Clocked in at ${new Date(todayAtt.check_in!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${
                    todayAtt.check_out
                      ? ` • Clocked out at ${new Date(todayAtt.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ' • Shift in progress'
                  }`
                : `Company office hours start at ${companySettings?.office_start_time || '09:00'} (Grace: ${companySettings?.grace_minutes || 15} mins)`}
            </p>
          </div>

          {/* Weekly Work Hours vs 40h Target */}
          <div className="w-full lg:w-72 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                Target Progress
              </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{weeklyHours}h / 40h</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${weeklyPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
              <span>{telemetry?.month_summary.late || 0} late arrivals this month</span>
              <span className="font-medium text-emerald-600">{telemetry?.month_summary.present || 0} days present</span>
            </div>
          </div>

          {/* Check-In / Out Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {!isCheckedIn ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleWebCheckIn}
                  disabled={attLoading}
                  className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 px-4 shadow-md bg-blue-600 hover:bg-blue-700"
                >
                  {attLoading ? <Spinner size="sm" /> : <Clock className="h-4 w-4" />}
                  <span>Web Check-In</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setCameraModalOpen(true)}
                  disabled={attLoading}
                  className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 px-4 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shadow-xs"
                >
                  <Camera className="h-4 w-4 text-indigo-600" />
                  <span>Camera + Geofence</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-900 rounded font-bold">
                    Bonus
                  </span>
                </Button>
              </>
            ) : !isCheckedOut ? (
              <Button
                variant="primary"
                onClick={handleWebCheckOut}
                disabled={attLoading}
                className="flex items-center justify-center gap-2 text-sm font-semibold py-2.5 px-6 shadow-md bg-amber-600 hover:bg-amber-700 text-white"
              >
                {attLoading ? <Spinner size="sm" /> : <LogOut className="h-4 w-4" />}
                <span>Check Out Shift</span>
              </Button>
            ) : (
              <div className="text-center px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span>Shift Complete</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Grid: Leave Balances + Last Payslip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annual Leave */}
        <Card className="hover:border-blue-300 dark:hover:border-blue-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Annual Leave</span>
            <Badge variant="blue">Quota</Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {telemetry?.leave_balance.annual.remaining ?? 14}
            </span>
            <span className="text-xs text-gray-400">
              days remaining of {telemetry?.leave_balance.annual.quota ?? 14}
            </span>
          </div>
          <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 flex items-center justify-between">
            <span>{telemetry?.leave_balance.annual.used ?? 0} days used</span>
            <Link href="/employee/leave" className="hover:underline flex items-center gap-0.5">
              Apply <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Sick Leave */}
        <Card className="hover:border-emerald-300 dark:hover:border-emerald-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sick Leave</span>
            <Badge variant="green">Quota</Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {telemetry?.leave_balance.sick.remaining ?? 8}
            </span>
            <span className="text-xs text-gray-400">
              days remaining of {telemetry?.leave_balance.sick.quota ?? 8}
            </span>
          </div>
          <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>{telemetry?.leave_balance.sick.used ?? 0} days used</span>
            <Link href="/employee/leave" className="hover:underline flex items-center gap-0.5">
              Apply <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Casual Leave */}
        <Card className="hover:border-amber-300 dark:hover:border-amber-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Casual Leave</span>
            <Badge variant="yellow">Quota</Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {telemetry?.leave_balance.casual.remaining ?? 10}
            </span>
            <span className="text-xs text-gray-400">
              days remaining of {telemetry?.leave_balance.casual.quota ?? 10}
            </span>
          </div>
          <div className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>{telemetry?.leave_balance.casual.used ?? 0} days used</span>
            <Link href="/employee/leave" className="hover:underline flex items-center gap-0.5">
              Apply <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>

        {/* Last Payslip Card */}
        <Card className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 dark:from-gray-900 dark:to-gray-800 border-indigo-200 dark:border-indigo-900/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Last Payslip
            </span>
            <FileText className="h-4 w-4 text-indigo-500" />
          </div>
          {latestPayslip ? (
            <div>
              <div className="text-lg font-extrabold text-gray-900 dark:text-white">
                {formatCurrency(latestPayslip.net_salary)}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Month: <span className="font-semibold">{latestPayslip.month}</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleDownloadPayslip(latestPayslip.id, latestPayslip.month)}
                  className="flex items-center gap-1.5 text-xs py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </Button>
                <Link
                  href="/employee/payslips"
                  className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-medium"
                >
                  View All
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-2">
              <p className="text-xs text-gray-500">No finalized payslips available yet.</p>
              <Link
                href="/employee/payslips"
                className="text-xs text-indigo-600 hover:underline font-medium mt-2 inline-block"
              >
                Go to Payslips
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Grid: Recent Attendance & Company Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Attendance Logs (2 Cols) */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Recent Attendance Logs
                </h3>
                <p className="text-xs text-gray-500">Your latest recorded shifts</p>
              </div>
              <Link
                href="/employee/attendance"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
              >
                Full Calendar <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {history.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No attendance logs found. Use the buttons above to check in.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Check In</th>
                      <th className="px-3 py-2.5">Check Out</th>
                      <th className="px-3 py-2.5">Hours</th>
                      <th className="px-3 py-2.5">Source</th>
                      <th className="px-3 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {history.map((h: any) => (
                      <tr key={h.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                          {formatDate(h.date)}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                          {h.check_in ? new Date(h.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                          {h.check_out ? new Date(h.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-gray-700 dark:text-gray-300">
                          {h.work_hours ? `${h.work_hours.toFixed(1)}h` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="capitalize text-gray-500">{h.source || 'web'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${getStatusColor(
                              h.status
                            )}`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Company Announcements (1 Col) */}
        <div>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Announcements
              </h3>
              <Badge variant="gray" className="text-[10px]">
                {Array.isArray(announcements) ? announcements.length : 0}
              </Badge>
            </div>

            {(!Array.isArray(announcements) || announcements.length === 0) ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No company announcements posted at this time.
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.slice(0, 4).map((ann) => (
                  <div
                    key={ann.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-white line-clamp-1">
                        {ann.title}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                          ann.priority === 'High'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {ann.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{ann.content}</p>
                    <span className="text-[10px] text-gray-400 mt-1.5 block">{formatDate(ann.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Camera Attendance Modal */}
      <CameraAttendanceModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onSuccess={() => {
          setSuccessMsg('Biometric & Geofence Check-In successfully verified!');
          setTimeout(() => setSuccessMsg(''), 4000);
          loadData();
        }}
        officeLat={companySettings?.office_lat}
        officeLng={companySettings?.office_lng}
        geofenceRadius={companySettings?.geofence_radius_m || 150}
      />
    </div>
  );
}
