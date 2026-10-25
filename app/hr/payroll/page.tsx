'use client';
import React, { useState, useEffect } from 'react';
import { CreditCard, RefreshCw, Download, Check, AlertCircle, FileText } from 'lucide-react';
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
  status: string;
  created_at: string;
  payslips?: Payslip[];
  total_gross?: number;
  total_net?: number;
  employee_count?: number;
}

export default function HRPayrollPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [currentRun, setCurrentRun] = useState<PayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchRunForMonth = async (month: string) => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/v1/payroll/runs');
      const runs: PayrollRun[] = res.data || [];
      const match = runs.find((r) => r.month === month);
      if (match) {
        const detailRes = await api.get(`/api/v1/payroll/runs/${match.id}`);
        setCurrentRun(detailRes.data);
      } else {
        setCurrentRun(null);
      }
    } catch (err) {
      console.error('Failed to query payroll', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRunForMonth(selectedMonth);
  }, [selectedMonth]);

  const handleGenerateDraft = async () => {
    setIsGenerating(true);
    setErrorMsg('');
    try {
      const res = await api.post('/api/v1/payroll/run', { month: selectedMonth });
      setCurrentRun(res.data);
      setSuccessMsg(`Draft payroll batch for ${selectedMonth} compiled successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to compile payroll run'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async (payslipId: number, name: string) => {
    try {
      const res = await api.get(`/api/v1/payroll/payslips/${payslipId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payslip_${name.replace(/\s+/g, '_')}_${selectedMonth}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download PDF payslip');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Payroll Draft Calculation Engine
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Compile monthly payroll batches, compute statutory tax brackets, calculate attendance deductions, and preview PDF slips
          </p>
        </div>
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

      {/* Control Bar */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Select Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleGenerateDraft}
            disabled={isGenerating || currentRun?.status === 'Finalized'}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isGenerating ? <Spinner size="sm" className="mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {currentRun ? 'Re-calculate Draft Run' : 'Generate Monthly Payroll Draft'}
          </Button>
        </div>
      </Card>

      {/* Results View */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : currentRun ? (
        <div className="space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
            <div>
              <span className="text-xs text-gray-500">Batch Status:</span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge
                  className={
                    currentRun.status === 'Finalized'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }
                >
                  {currentRun.status === 'Finalized' ? 'Locked (Finalized by Admin)' : 'Draft Mode (Editable)'}
                </Badge>
                <span className="text-xs text-gray-400">Created {formatDate(currentRun.created_at)}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-500">Total Net Disbursed:</span>
              <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(currentRun.payslips?.reduce((acc, p) => acc + p.net_salary, 0) || 0)}
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Calculated Employee Payslips ({currentRun.payslips?.length || 0})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Employee</th>
                    <th className="py-2.5 px-3 font-medium text-right">Basic</th>
                    <th className="py-2.5 px-3 font-medium text-right">HRA (40%)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Medical (10%)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Gross (1.5x)</th>
                    <th className="py-2.5 px-3 font-medium text-center">Absent/Unpaid</th>
                    <th className="py-2.5 px-3 font-medium text-right">Deductions</th>
                    <th className="py-2.5 px-3 font-medium text-right">Income Tax</th>
                    <th className="py-2.5 px-3 font-medium text-right font-bold">Net Pay</th>
                    <th className="py-2.5 px-3 font-medium text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono text-[11px]">
                  {currentRun.payslips?.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 font-sans">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{p.full_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.employee_code}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(p.basic_salary)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-500">{formatCurrency(p.hra)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-500">{formatCurrency(p.medical)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">{formatCurrency(p.gross_salary)}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-[10px] text-gray-500">
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
                          title="Download Payslip PDF"
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
        <Card className="p-12 text-center space-y-3">
          <FileText className="h-10 w-10 text-gray-300 mx-auto" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">No Payroll Batch for {selectedMonth}</h2>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Click &ldquo;Generate Monthly Payroll Draft&rdquo; above to query attendance telemetry, compute leave deductions, apply progressive tax slabs, and compile slips.
          </p>
        </Card>
      )}
    </div>
  );
}
