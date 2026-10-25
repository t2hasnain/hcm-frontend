'use client';
import React, { useState, useEffect } from 'react';
import { CreditCard, Lock, Download, Check, AlertCircle, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, extractErrorMessage } from '@/lib/utils';

interface Payslip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_code: string;
  full_name: string;
  basic_salary: number;
  hra: number;
  medical: number;
  gross_salary: number;
  working_days: number;
  absent_days: number;
  unpaid_leave_days: number;
  half_days: number;
  deductions: number;
  income_tax: number;
  net_salary: number;
}

interface PayrollRun {
  id: number;
  month: string;
  status: 'Draft' | 'Finalized';
  created_by?: number;
  finalized_by?: number;
  finalized_at?: string;
  created_at: string;
  payslips?: Payslip[];
  total_gross?: number;
  total_net?: number;
  employee_count?: number;
}

export default function AdminPayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/v1/payroll/runs');
      const list = res.data || [];
      setRuns(list);
      if (list.length > 0 && !selectedRun) {
        loadRunDetails(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load payroll runs', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRunDetails = async (runId: number) => {
    try {
      const res = await api.get(`/api/v1/payroll/runs/${runId}`);
      setSelectedRun(res.data);
    } catch (err) {
      setErrorMsg('Failed to load payroll run details');
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handleFinalize = async () => {
    if (!selectedRun) return;
    if (!confirm(`Are you sure you want to finalize and lock the payroll for ${selectedRun.month}? This action is irreversible.`)) {
      return;
    }
    setIsFinalizing(true);
    try {
      await api.post(`/api/v1/payroll/runs/${selectedRun.id}/finalize`);
      setSuccessMsg(`Payroll for ${selectedRun.month} successfully finalized and locked.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadRunDetails(selectedRun.id);
      loadRuns();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to finalize payroll'));
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadPDF = async (payslipId: number, employeeName: string) => {
    try {
      const res = await api.get(`/api/v1/payroll/payslips/${payslipId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payslip_${employeeName.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download payslip PDF');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Executive Payroll Finalization</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Audit monthly salary runs calculated by HR, review deductions and tax slabs, and execute finalization locks
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={loadRuns} title="Refresh runs">
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

      {/* Month Selection Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => loadRunDetails(r.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 shrink-0 border transition-colors ${
              selectedRun?.id === r.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{r.month}</span>
            <Badge
              className={`text-[10px] ${
                r.status === 'Finalized'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {r.status}
            </Badge>
          </button>
        ))}
      </div>

      {isLoading && !selectedRun ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : selectedRun ? (
        <div className="space-y-6">
          {/* Summary Box & Finalize Button */}
          <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Payroll Batch: {selectedRun.month}
                </h2>
                <Badge
                  className={
                    selectedRun.status === 'Finalized'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }
                >
                  {selectedRun.status === 'Finalized' ? 'Locked & Disbursed' : 'HR Draft Batch'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedRun.status === 'Finalized' && selectedRun.finalized_at
                  ? `Locked on ${formatDate(selectedRun.finalized_at)} by Administrator`
                  : 'Prepared by HR. Pending executive finalization.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {selectedRun.status === 'Draft' ? (
                <Button
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isFinalizing ? <Spinner size="sm" className="mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
                  Finalize & Lock Payroll
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold">
                  <Lock className="h-3.5 w-3.5" />
                  Finalized & Immutable
                </div>
              )}
            </div>
          </Card>

          {/* Payslips Detail Table */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Employee Disbursement Breakdown ({selectedRun.payslips?.length || 0})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Employee</th>
                    <th className="py-2.5 px-3 font-medium text-right">Basic</th>
                    <th className="py-2.5 px-3 font-medium text-right">HRA (40%)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Medical (10%)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Gross</th>
                    <th className="py-2.5 px-3 font-medium text-center">Unpaid / Half</th>
                    <th className="py-2.5 px-3 font-medium text-right">Deductions</th>
                    <th className="py-2.5 px-3 font-medium text-right">Tax (Slab)</th>
                    <th className="py-2.5 px-3 font-medium text-right font-bold">Net Salary</th>
                    <th className="py-2.5 px-3 font-medium text-right">Payslip PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono text-[11px]">
                  {selectedRun.payslips?.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 font-sans">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{p.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.employee_code}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(p.basic_salary)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-500">{formatCurrency(p.hra)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-500">{formatCurrency(p.medical)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">{formatCurrency(p.gross_salary)}</td>
                      <td className="py-2.5 px-3 text-center text-gray-500 font-mono text-[10px]">
                        {p.absent_days + p.unpaid_leave_days}d / {p.half_days}h
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                        {p.deductions > 0 ? `-${formatCurrency(p.deductions)}` : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600">
                        {p.income_tax > 0 ? `-${formatCurrency(p.income_tax)}` : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {formatCurrency(p.net_salary)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleDownloadPDF(p.id, p.full_name)}
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center text-gray-400 text-sm">
          No payroll batches have been generated by HR yet.
        </Card>
      )}
    </div>
  );
}
