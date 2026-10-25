'use client';
import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  Plus,
  RefreshCw,
  Filter,
  Check,
  X,
  MessageSquare,
  HelpCircle,
  Sparkles,
  Camera,
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, getStatusColor, extractErrorMessage } from '@/lib/utils';
import { CameraAttendanceModal } from '@/components/employee/CameraAttendanceModal';

interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  work_hours: number;
  source: string;
  face_verified: boolean;
}

interface CorrectionRecord {
  id: number;
  attendance_id?: number;
  date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: string;
  hr_comment?: string;
  created_at: string;
}

export default function EmployeeAttendancePage() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState<'attendance' | 'corrections'>('attendance');

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Correction Modal
  const [correctionModal, setCorrectionModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    requested_check_in: '09:00',
    requested_check_out: '18:00',
    reason: '',
    attendance_id: undefined as number | undefined,
  });

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [resAtt, resCorr, resComp] = await Promise.all([
        api.get(`/api/v1/attendance?month_filter=${selectedMonth}&limit=50`),
        api.get('/api/v1/attendance/corrections?limit=50'),
        api.get('/api/v1/setup/company').catch(() => ({ data: null })),
      ]);
      setAttendances(resAtt.data?.items || resAtt.data || []);
      setCorrections(resCorr.data?.items || resCorr.data || []);
      setCompanySettings(resComp.data);
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to load attendance logs'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const handleOpenCorrection = (record?: AttendanceRecord) => {
    if (record) {
      setCorrectionForm({
        date: record.date,
        requested_check_in: record.check_in
          ? new Date(record.check_in).toTimeString().slice(0, 5)
          : '09:00',
        requested_check_out: record.check_out
          ? new Date(record.check_out).toTimeString().slice(0, 5)
          : '18:00',
        reason: '',
        attendance_id: record.id,
      });
    } else {
      setCorrectionForm({
        date: new Date().toISOString().split('T')[0],
        requested_check_in: '09:00',
        requested_check_out: '18:00',
        reason: '',
        attendance_id: undefined,
      });
    }
    setCorrectionModal(true);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionForm.reason.trim()) {
      setErrorMsg('Please specify a reason for this attendance adjustment.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const datePart = correctionForm.date;
      const inDt = correctionForm.requested_check_in
        ? `${datePart}T${correctionForm.requested_check_in}:00`
        : null;
      const outDt = correctionForm.requested_check_out
        ? `${datePart}T${correctionForm.requested_check_out}:00`
        : null;

      await api.post('/api/v1/attendance/corrections', {
        date: datePart,
        requested_check_in: inDt,
        requested_check_out: outDt,
        reason: correctionForm.reason,
        attendance_id: correctionForm.attendance_id || null,
      });

      setSuccessMsg('Attendance correction request submitted to HR for adjudication!');
      setTimeout(() => setSuccessMsg(''), 5000);
      setCorrectionModal(false);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to submit correction request'));
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics for selected month
  const totalDays = attendances.length;
  const presentCount = attendances.filter((a) => a.status === 'present').length;
  const lateCount = attendances.filter((a) => a.status === 'late').length;
  const halfCount = attendances.filter((a) => a.status === 'half_day').length;
  const totalHours = attendances.reduce((acc, curr) => acc + (curr.work_hours || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            My Attendance & Timesheet History
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Audit monthly shift attendance records and submit missing check-in/out correction requests
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-1.5 shadow-2xs">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setCameraModalOpen(true)}
            className="flex items-center gap-1.5 text-xs py-2 px-3 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            <Camera className="h-4 w-4 text-indigo-600" />
            <span>Camera Check-In</span>
            <span className="text-[10px] px-1 py-0.2 bg-indigo-100 dark:bg-indigo-900 rounded font-bold">
              Bonus
            </span>
          </Button>

          <Button
            variant="primary"
            onClick={() => handleOpenCorrection()}
            className="flex items-center gap-1.5 text-xs py-2 px-3 shadow-sm bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Request Correction</span>
          </Button>
        </div>
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

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <Card className="p-3.5 text-center">
          <span className="text-xs text-gray-500 font-medium block">Working Records</span>
          <span className="text-xl font-bold text-gray-900 dark:text-white mt-1 block">{totalDays}</span>
        </Card>
        <Card className="p-3.5 text-center">
          <span className="text-xs text-gray-500 font-medium block">On-Time</span>
          <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">{presentCount}</span>
        </Card>
        <Card className="p-3.5 text-center">
          <span className="text-xs text-gray-500 font-medium block">Late Arrivals</span>
          <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">{lateCount}</span>
        </Card>
        <Card className="p-3.5 text-center">
          <span className="text-xs text-gray-500 font-medium block">Half Days</span>
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">{halfCount}</span>
        </Card>
        <Card className="p-3.5 text-center col-span-2 sm:col-span-1">
          <span className="text-xs text-gray-500 font-medium block">Total Shift Hours</span>
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 block">{totalHours.toFixed(1)}h</span>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`pb-2.5 transition-colors relative ${
            activeTab === 'attendance'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Monthly Logs ({attendances.length})
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`pb-2.5 transition-colors relative ${
            activeTab === 'corrections'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          My Correction Requests ({corrections.length})
        </button>
      </div>

      {/* Tab 1: Attendance Table */}
      {activeTab === 'attendance' && (
        <Card>
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <Spinner size="md" />
              <span className="text-xs text-gray-400">Loading timesheet records...</span>
            </div>
          ) : attendances.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              No attendance records found for {selectedMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Check In</th>
                    <th className="px-4 py-3 font-semibold">Check Out</th>
                    <th className="px-4 py-3 font-semibold">Work Hours</th>
                    <th className="px-4 py-3 font-semibold">Punch Source</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {formatDate(att.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {att.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {att.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white">
                        {att.work_hours > 0 ? `${att.work_hours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-[11px] font-medium text-gray-500 flex items-center gap-1">
                          {att.source === 'camera' && <Camera className="h-3 w-3 text-indigo-500" />}
                          {att.source || 'web'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${getStatusColor(
                            att.status
                          )}`}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenCorrection(att)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:underline"
                        >
                          Correction
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Correction Requests */}
      {activeTab === 'corrections' && (
        <Card>
          {corrections.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              You have not submitted any attendance correction requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Requested Times</th>
                    <th className="px-4 py-3 font-semibold">Reason</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">HR Comment</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {corrections.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{formatDate(c.date)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {c.requested_check_in ? new Date(c.requested_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        {' → '}
                        {c.requested_check_out ? new Date(c.requested_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{c.reason}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            c.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : c.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 italic text-[11px]">{c.hr_comment || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Request Correction Modal */}
      <Modal isOpen={correctionModal} onClose={() => setCorrectionModal(false)} title="Request Attendance Correction">
        <form onSubmit={handleSubmitCorrection} className="space-y-4">
          <Input
            label="Shift Date *"
            type="date"
            value={correctionForm.date}
            onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Actual Check In Time"
              type="time"
              value={correctionForm.requested_check_in}
              onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_in: e.target.value })}
            />
            <Input
              label="Actual Check Out Time"
              type="time"
              value={correctionForm.requested_check_out}
              onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_out: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Correction Reason & Justification *
            </label>
            <textarea
              rows={3}
              value={correctionForm.reason}
              onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
              placeholder="e.g. Forgot to punch out due to on-site client meeting at Gulshan branch."
              required
              className="w-full text-xs p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="outline" onClick={() => setCorrectionModal(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !correctionForm.reason.trim()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
              <span>Submit for Approval</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Camera Attendance Modal */}
      <CameraAttendanceModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onSuccess={() => {
          setSuccessMsg('Biometric & Geofenced Check-In recorded successfully!');
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
