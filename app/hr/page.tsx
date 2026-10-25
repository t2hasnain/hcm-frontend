'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  AlertCircle,
  Sparkles,
  RefreshCw,
  CheckCircle,
  LogOut,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  UserMinus,
  ShieldCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { extractErrorMessage } from '@/lib/utils';

interface HRKPIs {
  headcount: number;
  present_today: number;
  on_leave_today: {
    total: number;
    casual: number;
    sick: number;
    annual: number;
    unpaid: number;
  };
  late_today: number;
  pending_approvals: {
    leaves: number;
    corrections: number;
    total: number;
  };
  attendance_rate: number;
  late_pct_by_department: { department: string; late_pct: number }[];
  leave_utilization: Record<string, number>;
  top_late_comers: { employee_code: string; full_name: string; late_count: number }[];
  attrition_risk_summary?: {
    average_score: number;
    high_risk_count: number;
    at_risk: { employee_code: string; full_name: string; score: number; risk_level: string; primary_risk: string }[];
  };
  absence_anomalies?: {
    employee_code: string;
    full_name: string;
    anomaly_type: string;
    details: string;
  }[];
}

const COLORS = ['#0066FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function HRDashboardPage() {
  const [data, setData] = useState<HRKPIs | null>(null);
  const [myStatus, setMyStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resHR, resSelf] = await Promise.all([
        api.get('/api/v1/analytics/hr'),
        api.get('/api/v1/analytics/employee').catch(() => ({ data: null })),
      ]);
      setData(resHR.data);
      setMyStatus(resSelf.data);
    } catch (err) {
      console.error('Failed to load HR analytics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSummarizeWithAI = async () => {
    if (!data) return;
    setAiLoading(true);
    try {
      const res = await api.post('/api/v1/ai/dashboard-summary', { kpi_data: data });
      if (res.data?.bullets) {
        setAiSummary(res.data.bullets);
      } else if (Array.isArray(res.data)) {
        setAiSummary(res.data);
      } else if (res.data?.summary) {
        setAiSummary(res.data.summary.split('\n').filter(Boolean));
      }
    } catch (err) {
      console.error('AI summary failed', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSelfCheckIn = async () => {
    try {
      await api.post('/api/v1/attendance/check-in', { source: 'web' });
      fetchData();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Check-in failed'));
    }
  };

  const handleSelfCheckOut = async () => {
    try {
      await api.post('/api/v1/attendance/check-out', {});
      fetchData();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Check-out failed'));
    }
  };

  if (isLoading && !data) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const leaveUtilData = data?.leave_utilization
    ? Object.entries(data.leave_utilization).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">People Operations Dashboard</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time daily roster, attendance compliance, pending approval queues, and staff absenteeism
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSummarizeWithAI}
            disabled={aiLoading}
            className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
          >
            {aiLoading ? <Spinner size="sm" className="mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5 text-purple-600" />}
            Summarize with AI
          </Button>

          <Button variant="ghost" size="sm" onClick={fetchData} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* AI Summary Box */}
      {aiSummary && (
        <Card className="bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                AI Workforce Synthesis
              </h3>
            </div>
            <Badge className="bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-[10px]">
              AI-generated
            </Badge>
          </div>
          <ul className="space-y-1.5 text-xs text-purple-950 dark:text-purple-200/90 list-disc list-inside">
            {aiSummary.map((bullet, idx) => (
              <li key={idx} className="leading-relaxed">
                {bullet.replace(/^[-•*]\s*/, '')}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Headcount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{data?.headcount ?? 0}</p>
            <p className="text-[11px] text-gray-400 mt-1">Total active workforce</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Present Today</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {data?.present_today ?? 0}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Rate: {(data?.attendance_rate ?? 0).toFixed(0)}%
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">On Leave Today</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {data?.on_leave_today?.total ?? 0}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              {data?.on_leave_today?.casual ?? 0} Casual • {data?.on_leave_today?.sick ?? 0} Sick
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
            <Calendar className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Late Arrivals</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {data?.late_today ?? 0}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Past grace cutoff</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium">Pending Approvals</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {data?.pending_approvals?.total ?? 0}
            </p>
            <Link href="/hr/approvals" className="text-[11px] text-blue-600 hover:underline flex items-center mt-1">
              Review queue <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-10 w-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* HR Self-Service Bar */}
      {myStatus && (
        <Card className="p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-100 dark:border-blue-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                My Self-Service
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Today&apos;s Status:{' '}
                {(myStatus.today_attendance?.checked_in || myStatus.today_status?.checked_in) ? (
                  <span className="font-semibold text-emerald-600">
                    Checked in at{' '}
                    {(myStatus.today_attendance?.check_in
                      ? new Date(myStatus.today_attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : myStatus.today_status?.check_in_time || 'Recorded')}{' '}
                    ({myStatus.today_attendance?.status || myStatus.today_status?.status || 'Present'})
                  </span>
                ) : (
                  <span className="font-semibold text-amber-600">Not checked in yet</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!(myStatus.today_attendance?.checked_in || myStatus.today_status?.checked_in) ? (
                <Button size="sm" onClick={handleSelfCheckIn} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CheckCircle className="h-4 w-4 mr-1.5" /> Web Check-In
                </Button>
              ) : !(myStatus.today_attendance?.check_out || myStatus.today_status?.check_out_time) ? (
                <Button size="sm" onClick={handleSelfCheckOut} variant="outline" className="text-rose-600 border-rose-200">
                  <LogOut className="h-4 w-4 mr-1.5" /> Check-Out
                </Button>
              ) : (
                <Badge className="bg-gray-100 text-gray-600">Shift Completed</Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Late % by Dept */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Late Arrival % by Department</h2>
          <div className="h-64">
            {data?.late_pct_by_department?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.late_pct_by_department} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="department" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: any) => `${((Number(val) || 0) * 100).toFixed(1)}%`} />
                  <Bar dataKey="late_pct" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Late %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No departmental late arrival records
              </div>
            )}
          </div>
        </Card>

        {/* Leave Utilization */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Leave Utilization Breakdown</h2>
          <div className="h-64">
            {leaveUtilData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leaveUtilData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                    {leaveUtilData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No leave requests logged this month
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top 5 Late Comers */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Top 5 Late-Comers This Month (Attention Required)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="py-2.5 px-3 font-medium">Employee</th>
                <th className="py-2.5 px-3 font-medium">Employee Code</th>
                <th className="py-2.5 px-3 font-medium text-right">Late Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data?.top_late_comers?.length ? (
                data.top_late_comers.map((e, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">{e.full_name}</td>
                    <td className="py-2.5 px-3 font-mono text-gray-500">{e.employee_code}</td>
                    <td className="py-2.5 px-3 text-right">
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        {e.late_count} times
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-gray-400">
                    Excellent attendance compliance — no recurring late arrivals this month!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bonus Features: Attrition Risk & Absence Anomaly Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attrition Risk Scorecard (Bonus B2) */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Attrition Risk Scoring
              </h2>
            </div>
            <Badge className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-[10px]">
              Avg Index: {data?.attrition_risk_summary?.average_score ?? 12}/100
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2 px-3 font-medium">Employee</th>
                  <th className="py-2 px-3 font-medium">Risk Factor</th>
                  <th className="py-2 px-3 font-medium text-right">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.attrition_risk_summary?.at_risk?.length ? (
                  data.attrition_risk_summary.at_risk.map((emp, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-gray-900 dark:text-white block">{emp.full_name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{emp.employee_code}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-[11px]">{emp.primary_risk}</td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge
                          className={
                            emp.risk_level === 'High'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }
                        >
                          {emp.risk_level} ({emp.score}%)
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      Workforce retention healthy — zero high-attrition indicators detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Absence Anomaly Flags (Bonus B3) */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Absence Anomaly Flags
              </h2>
            </div>
            <span className="text-[11px] text-gray-400">Shift Patterns</span>
          </div>

          <div className="space-y-2.5">
            {data?.absence_anomalies?.length ? (
              data.absence_anomalies.map((anom, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white text-xs block">
                      {anom.full_name} ({anom.employee_code})
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 block">
                      {anom.details}
                    </span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] shrink-0">
                    {anom.anomaly_type}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-gray-400">
                No shift anomalies or uncompleted punch-out patterns found this month.
              </div>
            )}

            {/* Late Penalty Rule Banner (Bonus B4) */}
            <div className="mt-3 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <ShieldCheck className="h-4 w-4 text-[#0066FF] shrink-0" />
                <span>
                  <strong>Late Penalty Policy:</strong> Every 3 late arrivals automatically trigger a 0.5 day wage deduction during payroll finalization.
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
