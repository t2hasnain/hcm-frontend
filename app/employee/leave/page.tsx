'use client';
import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  CheckCircle,
  AlertCircle,
  XCircle,
  Send,
  Trash2,
  Clock,
  RotateCcw,
  Check,
  Bot,
  HelpCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, extractErrorMessage } from '@/lib/utils';

interface LeaveBalance {
  quota: number;
  used: number;
  remaining: number;
}

interface LeaveRecord {
  id: number;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: string;
  hr_comment?: string;
  created_at: string;
}

export default function EmployeeLeavePage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [balances, setBalances] = useState<{
    annual: LeaveBalance;
    sick: LeaveBalance;
    casual: LeaveBalance;
    unpaid_used?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AI Smart Leave
  const [naturalText, setNaturalText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiFilled, setIsAiFilled] = useState(false);

  // Structured Leave Form
  const [form, setForm] = useState({
    leave_type: 'Annual',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Feedback messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [resBal, resList] = await Promise.all([
        api.get('/api/v1/leave/balance'),
        api.get('/api/v1/leave?limit=50'),
      ]);
      setBalances(resBal.data);
      setLeaves(resList.data?.items || resList.data || []);
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to load leave records and balance.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAiParse = async (sampleText?: string) => {
    const textToParse = sampleText || naturalText;
    if (!textToParse.trim()) return;

    if (sampleText) setNaturalText(sampleText);
    setAiLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/api/v1/ai/smart-leave', {
        natural_text: textToParse,
        today_date: new Date().toISOString().split('T')[0],
      });

      const data = res.data;
      if (data?.error) {
        setErrorMsg(`AI parser notice: ${data.error}`);
        return;
      }

      setForm({
        leave_type: data.leave_type || 'Annual',
        start_date: data.start_date || '',
        end_date: data.end_date || data.start_date || '',
        reason: data.reason || textToParse,
      });
      setIsAiFilled(true);
      setSuccessMsg('AI parsed your request and populated the form below. Please review and confirm!');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'AI service was unable to parse this request. You can fill the form manually below.'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.start_date || !form.end_date || !form.reason.trim()) {
      setErrorMsg('Please specify start date, end date, and reason.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await api.post('/api/v1/leave/apply', form);
      setSuccessMsg('Leave application successfully submitted for HR approval!');
      setTimeout(() => setSuccessMsg(''), 5000);
      setForm({ leave_type: 'Annual', start_date: '', end_date: '', reason: '' });
      setNaturalText('');
      setIsAiFilled(false);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to submit leave application'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: number) => {
    if (!confirm('Are you sure you want to cancel this pending leave request?')) return;
    try {
      await api.put(`/api/v1/leave/${leaveId}/cancel`);
      setSuccessMsg('Leave request cancelled successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to cancel leave request'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          Smart Leave Portal & Entitlements
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Type leave requests in plain English or Roman Urdu — Azure OpenAI auto-fills dates, leave type, and reasons
        </p>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Leave Balance Quota Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Annual */}
        <Card className="border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Annual Leave
            </span>
            <Badge variant="blue">Quota: {balances?.annual.quota ?? 14}</Badge>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {balances?.annual.remaining ?? 14} <span className="text-xs font-normal text-gray-400">days left</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{balances?.annual.used ?? 0} days taken this calendar year</p>
        </Card>

        {/* Sick */}
        <Card className="border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Sick Leave
            </span>
            <Badge variant="green">Quota: {balances?.sick.quota ?? 8}</Badge>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {balances?.sick.remaining ?? 8} <span className="text-xs font-normal text-gray-400">days left</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{balances?.sick.used ?? 0} days taken this calendar year</p>
        </Card>

        {/* Casual */}
        <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-gray-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Casual Leave
            </span>
            <Badge variant="yellow">Quota: {balances?.casual.quota ?? 10}</Badge>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {balances?.casual.remaining ?? 10} <span className="text-xs font-normal text-gray-400">days left</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{balances?.casual.used ?? 0} days taken this calendar year</p>
        </Card>
      </div>

      {/* AI Smart Leave Composer */}
      <Card className="border-indigo-200 dark:border-indigo-900 shadow-md bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                AI Smart Leave Composer
                <Badge variant="blue" className="text-[10px]">Natural NLP</Badge>
              </h2>
              <p className="text-xs text-gray-500">English and Roman Urdu sentences automatically structured</p>
            </div>
          </div>
        </div>

        {/* NLP Input Box */}
        <div className="space-y-3">
          <div className="relative">
            <textarea
              rows={2}
              value={naturalText}
              onChange={(e) => setNaturalText(e.target.value)}
              placeholder="Type your request: e.g. 'I need next Monday and Tuesday off for my sister's wedding' or 'Mujhe agle Monday aur Tuesday shadi ke liye chhutti chahiye'..."
              className="w-full text-xs p-3.5 pr-28 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <div className="absolute right-2.5 bottom-3">
              <Button
                variant="primary"
                onClick={() => handleAiParse()}
                disabled={aiLoading || !naturalText.trim()}
                className="flex items-center gap-1.5 text-xs py-1.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-xs"
              >
                {aiLoading ? <Spinner size="sm" /> : <Sparkles className="h-3.5 w-3.5 text-yellow-300" />}
                <span>Auto-Fill with AI</span>
              </Button>
            </div>
          </div>

          {/* Prompt chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-gray-400">Try quick samples:</span>
            <button
              type="button"
              onClick={() =>
                handleAiParse("I need next Monday and Tuesday off for my sister's wedding in Lahore")
              }
              className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-600 dark:text-gray-300 transition-colors"
            >
              🇺🇸 "Next Monday and Tuesday for sister's wedding"
            </button>
            <button
              type="button"
              onClick={() =>
                handleAiParse("Mujhe agle Monday aur Tuesday shadi ke liye chhutti chahiye")
              }
              className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-600 dark:text-gray-300 transition-colors"
            >
              🇵🇰 "Mujhe agle Monday aur Tuesday shadi ke liye chhutti chahiye"
            </button>
            <button
              type="button"
              onClick={() =>
                handleAiParse("Feeling unwell with severe fever, requesting 3 days sick leave starting tomorrow")
              }
              className="text-[11px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-600 dark:text-gray-300 transition-colors"
            >
              🤒 "3 days sick leave starting tomorrow"
            </button>
          </div>
        </div>

        {/* Structured Application Form */}
        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Application Details
              {isAiFilled && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="h-3 w-3 text-indigo-500" />
                  AI-Generated
                </span>
              )}
            </h3>
            <span className="text-xs text-gray-400">Review and verify before submitting</span>
          </div>

          <form onSubmit={handleConfirmApply} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Leave Type *
                </label>
                <select
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Casual">Casual Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                </select>
              </div>

              <Input
                label="Start Date *"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />

              <Input
                label="End Date *"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Reason / Justification *
              </label>
              <textarea
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="State the reason for taking leave..."
                required
                className="w-full text-xs p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !form.start_date || !form.end_date || !form.reason.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-5 shadow-sm"
              >
                {submitting ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                <span>Confirm & Apply</span>
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* Leave Application History Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            My Leave Request History
          </h2>
          <Badge variant="gray" className="text-xs">
            {leaves.length} Applications
          </Badge>
        </div>

        {leaves.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No leave requests logged yet. Use the AI composer above to submit one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Working Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">HR Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                      {l.leave_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                      {formatDate(l.start_date)}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                      {formatDate(l.end_date)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {l.working_days} {l.working_days === 1 ? 'day' : 'days'}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-600 dark:text-gray-400">
                      {l.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          l.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : l.status === 'Rejected'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 italic">
                      {l.hr_comment || (l.status === 'Pending' ? 'Pending HR approval' : '—')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {l.status === 'Pending' && (
                        <button
                          onClick={() => handleCancelLeave(l.id)}
                          className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 font-semibold hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
