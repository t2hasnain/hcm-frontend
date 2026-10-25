'use client';
import React, { useState, useEffect } from 'react';
import { UserCheck, Calendar, Clock, Check, X, AlertCircle, RefreshCw, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, extractErrorMessage } from '@/lib/utils';

interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_code?: string;
  full_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: string;
  created_at: string;
}

interface AttendanceCorrection {
  id: number;
  employee_id: number;
  employee_code?: string;
  full_name?: string;
  date: string;
  requested_check_in?: string;
  requested_check_out?: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function HRApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'leaves' | 'corrections'>('leaves');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Decision Modal
  const [decisionModal, setDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'Approved' | 'Rejected'>('Approved');
  const [targetId, setTargetId] = useState<number | null>(null);
  const [targetKind, setTargetKind] = useState<'leave' | 'correction'>('leave');
  const [hrComment, setHrComment] = useState('');

  // Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resLeaves, resCorr] = await Promise.all([
        api.get('/api/v1/leave'),
        api.get('/api/v1/attendance/corrections'),
      ]);
      setLeaves(resLeaves.data?.items || resLeaves.data || []);
      setCorrections(resCorr.data?.items || resCorr.data || []);
    } catch (err) {
      console.error('Failed to load approvals queue', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDecision = (id: number, kind: 'leave' | 'correction', decision: 'Approved' | 'Rejected') => {
    setTargetId(id);
    setTargetKind(kind);
    setDecisionType(decision);
    setHrComment('');
    setDecisionModal(true);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;

    try {
      if (targetKind === 'leave') {
        await api.put(`/api/v1/leave/${targetId}/decision`, {
          status: decisionType,
          hr_comment: hrComment || (decisionType === 'Approved' ? 'Approved by HR' : 'Rejected by HR'),
        });
        setSuccessMsg(`Leave request #${targetId} marked as ${decisionType}`);
      } else {
        await api.put(`/api/v1/attendance/corrections/${targetId}`, {
          status: decisionType,
          hr_comment: hrComment || (decisionType === 'Approved' ? 'Correction approved' : 'Correction rejected'),
        });
        setSuccessMsg(`Attendance correction #${targetId} marked as ${decisionType}`);
      }
      setTimeout(() => setSuccessMsg(''), 4000);
      setDecisionModal(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to process decision'));
    }
  };

  const pendingLeaves = leaves.filter((l) => l.status === 'Pending');
  const pendingCorrections = corrections.filter((c) => c.status === 'Pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            Approval Queues & Attendance Adjudication
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Adjudicate incoming staff leave applications and attendance correction requests with audit logging
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 text-xs text-rose-800 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'leaves'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Leave Requests
          {pendingLeaves.length > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center">
              {pendingLeaves.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('corrections')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'corrections'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Clock className="h-4 w-4" />
          Attendance Corrections
          {pendingCorrections.length > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center">
              {pendingCorrections.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LEAVES */}
      {activeTab === 'leaves' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Leave Applications ({leaves.length})</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Employee</th>
                  <th className="py-2.5 px-3 font-medium">Leave Type</th>
                  <th className="py-2.5 px-3 font-medium">Duration</th>
                  <th className="py-2.5 px-3 font-medium text-center">Days</th>
                  <th className="py-2.5 px-3 font-medium">Reason</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center">
                      <Spinner size="md" />
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No leave requests pending in queue
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{l.full_name || `Employee #${l.employee_id}`}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{l.employee_code}</p>
                      </td>
                      <td className="py-3 px-3">
                        <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {l.leave_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(l.start_date)} → {formatDate(l.end_date)}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-gray-900 dark:text-gray-100">
                        {l.working_days}
                      </td>
                      <td className="py-3 px-3 text-gray-500 max-w-xs truncate">{l.reason}</td>
                      <td className="py-3 px-3">
                        <Badge
                          className={
                            l.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : l.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        {l.status === 'Pending' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openDecision(l.id, 'leave', 'Approved')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDecision(l.id, 'leave', 'Rejected')}
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-7 px-2"
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 2: ATTENDANCE CORRECTIONS */}
      {activeTab === 'corrections' && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Attendance Corrections ({corrections.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Employee</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium">Requested Check-In</th>
                  <th className="py-2.5 px-3 font-medium">Requested Check-Out</th>
                  <th className="py-2.5 px-3 font-medium">Reason</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Adjudication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center">
                      <Spinner size="md" />
                    </td>
                  </tr>
                ) : corrections.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">
                      No correction requests in queue
                    </td>
                  </tr>
                ) : (
                  corrections.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                      <td className="py-3 px-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{c.full_name || `Employee #${c.employee_id}`}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{c.employee_code}</p>
                      </td>
                      <td className="py-3 px-3 font-mono">{formatDate(c.date)}</td>
                      <td className="py-3 px-3 font-mono text-emerald-600">
                        {c.requested_check_in ? new Date(c.requested_check_in).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-rose-600">
                        {c.requested_check_out ? new Date(c.requested_check_out).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-3 px-3 text-gray-500 max-w-xs truncate">{c.reason}</td>
                      <td className="py-3 px-3">
                        <Badge
                          className={
                            c.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        {c.status === 'Pending' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openDecision(c.id, 'correction', 'Approved')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDecision(c.id, 'correction', 'Rejected')}
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-7 px-2"
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-[11px] text-gray-400">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Decision Comment Modal */}
      {decisionModal && (
        <Modal
          isOpen={decisionModal}
          onClose={() => setDecisionModal(false)}
          title={`Confirm ${decisionType}: ${targetKind === 'leave' ? 'Leave Request' : 'Attendance Correction'}`}
        >
          <form onSubmit={handleDecisionSubmit} className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Please enter an optional administrative remark. This comment will be delivered to the employee in their in-app notification and logged in the immutable audit ledger.
            </p>

            <Input
              label="HR Remark / Justification"
              value={hrComment}
              onChange={(e) => setHrComment(e.target.value)}
              placeholder={decisionType === 'Approved' ? 'Approved as per company policy' : 'Quota exhausted / shift conflicts'}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setDecisionModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className={decisionType === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
              >
                Confirm {decisionType}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
