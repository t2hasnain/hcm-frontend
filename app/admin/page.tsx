'use client';
import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingDown,
  CreditCard,
  DollarSign,
  Sparkles,
  RefreshCw,
  Bell,
  ScrollText,
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
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface AdminKPIs {
  headcount: { active: number; probation: number; total: number };
  attrition_rate: number;
  payroll: { total_gross: number; total_net: number; month: string };
  avg_salary: number;
  headcount_by_department: { department: string; count: number }[];
  payroll_by_department: { department: string; gross: number; net: number }[];
  gender_breakdown: Record<string, number>;
  tenure_breakdown: Record<string, number>;
  recent_audit_feed: {
    id: number;
    actor_email: string;
    action: string;
    entity: string;
    created_at: string;
  }[];
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  author_name?: string;
  created_at: string;
}

const COLORS = ['#0066FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminKPIs | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // AI summary state
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedDept) params.department_id = selectedDept;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const [resAdmin, resAnn, resDept] = await Promise.all([
        api.get('/api/v1/analytics/admin', { params }),
        api.get('/api/v1/comms/announcements').catch(() => ({ data: [] })),
        api.get('/api/v1/setup/departments').catch(() => ({ data: [] })),
      ]);

      setData(resAdmin.data);
      const annList = Array.isArray(resAnn.data?.items)
        ? resAnn.data.items
        : Array.isArray(resAnn.data)
        ? resAnn.data
        : [];
      setAnnouncements(annList);
      setDepartments(Array.isArray(resDept.data) ? resDept.data : resDept.data?.items || []);
    } catch (err) {
      console.error('Failed to load admin analytics', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDept, startDate, endDate]);

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

  if (isLoading && !data) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const genderData = data?.gender_breakdown
    ? Object.entries(data.gender_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  const tenureData = data?.tenure_breakdown
    ? Object.entries(data.tenure_breakdown).map(([name, count]) => ({ name, count }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Executive Overview</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time workforce demographics, payroll expenditure, and organizational telemetry
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs h-9 px-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs h-9 px-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleSummarizeWithAI}
            disabled={aiLoading}
            className="bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100"
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
                Executive AI Intelligence
              </h3>
            </div>
            <Badge className="bg-purple-200 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 text-[10px]">
              AI-generated (gpt-5.4-mini)
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Headcount</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {data?.headcount?.total ?? 0}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
              <span>{data?.headcount?.active ?? 0} Active</span>
              <span>•</span>
              <span>{data?.headcount?.probation ?? 0} Probation</span>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Attrition YTD</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {(data?.attrition_rate ?? 0).toFixed(1)}%
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Rolling annualized turnover</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <TrendingDown className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Monthly Payroll ({data?.payroll?.month || 'Current'})
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(data?.payroll?.total_gross ?? 0)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Net Disbursed: {formatCurrency(data?.payroll?.total_net ?? 0)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CreditCard className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Average Monthly Salary</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {formatCurrency(data?.avg_salary ?? 0)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">Across all registered roles</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <DollarSign className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by Dept */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Headcount by Department</h2>
          <div className="h-64">
            {data?.headcount_by_department?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.headcount_by_department} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="department" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name="Headcount" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No departmental headcount records found
              </div>
            )}
          </div>
        </Card>

        {/* Payroll by Dept */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Payroll Cost by Department</h2>
          <div className="h-64">
            {data?.payroll_by_department?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.payroll_by_department} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="department" angle={-15} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: any) => formatCurrency(Number(val) || 0)} />
                  <Bar dataKey="gross" fill="#10b981" radius={[4, 4, 0, 0]} name="Gross" />
                  <Bar dataKey="net" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Net" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No department payroll data available yet
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Demographics & Tenure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gender Breakdown */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Gender Diversity</h2>
          <div className="h-56">
            {genderData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {genderData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No gender demographic data
              </div>
            )}
          </div>
        </Card>

        {/* Tenure Breakdown */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tenure Distribution</h2>
          <div className="h-56">
            {tenureData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenureData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Employees" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                No tenure data available
              </div>
            )}
          </div>
        </Card>

        {/* Company Announcements */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Bell className="h-4 w-4 text-blue-600" />
              Announcements
            </h2>
          </div>
          <div className="space-y-2.5 max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {announcements.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No company announcements</p>
            ) : (
              announcements.slice(0, 5).map((a) => (
                <div key={a.id} className="pt-2 first:pt-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{a.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{a.content}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatDate(a.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Live Audit Feed */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
            <ScrollText className="h-4 w-4 text-emerald-600" />
            Live Mutation Audit Feed
          </h2>
          <span className="text-[11px] text-gray-400">Latest 10 recorded actions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="py-2 px-3 font-medium">Actor</th>
                <th className="py-2 px-3 font-medium">Action</th>
                <th className="py-2 px-3 font-medium">Entity</th>
                <th className="py-2 px-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
              {data?.recent_audit_feed?.length ? (
                data.recent_audit_feed.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="py-2 px-3 font-mono text-[11px]">{a.actor_email || 'System'}</td>
                    <td className="py-2 px-3">
                      <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-[10px]">
                        {a.action}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">{a.entity}</td>
                    <td className="py-2 px-3 text-gray-400">{formatDate(a.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No audit records registered yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
