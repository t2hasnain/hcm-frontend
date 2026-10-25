'use client';
import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Upload,
  Download,
  Search,
  Eye,
  Edit2,
  Copy,
  Check,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatCurrency, formatDate, getStatusColor, extractErrorMessage } from '@/lib/utils';

interface Employee {
  id: number;
  user_id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  gender?: string;
  department_id?: number;
  department_name?: string;
  designation_id?: number;
  designation_title?: string;
  joining_date: string;
  status: string;
  basic_salary: number;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function HREmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: number; title: string; department_id: number }[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Drawers
  const [registerModal, setRegisterModal] = useState(false);
  const [tempPwdModal, setTempPwdModal] = useState(false);
  const [tempPwdInfo, setTempPwdInfo] = useState({ name: '', email: '', password: '', code: '' });
  const [copied, setCopied] = useState(false);

  // 360 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile360, setProfile360] = useState<any>(null);
  const [loading360, setLoading360] = useState(false);

  // CSV Import Modal
  const [csvModal, setCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvValidation, setCsvValidation] = useState<any>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    address: '',
    gender: 'Male',
    department_id: '',
    designation_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    status: 'Active',
    basic_salary: 60000,
  });

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (search) params.q = search;
      if (deptFilter) params.department_id = deptFilter;
      if (statusFilter) params.status = statusFilter;

      const [resEmp, resDept, resDes] = await Promise.all([
        api.get('/api/v1/employees', { params }),
        api.get('/api/v1/setup/departments').catch(() => ({ data: [] })),
        api.get('/api/v1/setup/designations').catch(() => ({ data: [] })),
      ]);

      setEmployees(resEmp.data?.items || []);
      setTotal(resEmp.data?.total || 0);
      setDepartments(resDept.data || []);
      setDesignations(resDes.data || []);
    } catch (err: any) {
      setErrorMsg('Failed to fetch employee directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [page, deptFilter, statusFilter]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...form,
        basic_salary: Number(form.basic_salary),
      };
      if (form.department_id) payload.department_id = Number(form.department_id);
      else delete payload.department_id;
      if (form.designation_id) payload.designation_id = Number(form.designation_id);
      else delete payload.designation_id;

      const res = await api.post('/api/v1/employees', payload);
      setRegisterModal(false);

      // Open temp password showcase modal
      setTempPwdInfo({
        name: res.data.employee.full_name,
        email: res.data.employee.email,
        password: res.data.temporary_password,
        code: res.data.employee.employee_code,
      });
      setTempPwdModal(true);

      loadEmployees();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Employee registration failed'));
    }
  };

  const handleOpen360 = async (empId: number) => {
    setLoading360(true);
    setDrawerOpen(true);
    try {
      const res = await api.get(`/api/v1/employees/${empId}/360`);
      setProfile360(res.data);
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to load Employee 360 profile'));
      setDrawerOpen(false);
    } finally {
      setLoading360(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/api/v1/employees/csv-export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `employees_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('CSV Export failed');
    }
  };

  const handleCsvDryRun = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await api.post('/api/v1/employees/csv-import?dry_run=true', formData);
      setCsvValidation(res.data);
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'CSV dry run failed'));
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCsvCommit = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await api.post('/api/v1/employees/csv-import?dry_run=false', formData);
      setSuccessMsg(`Successfully imported ${res.data.created_count} employee accounts!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setCsvModal(false);
      setCsvFile(null);
      setCsvValidation(null);
      loadEmployees();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'CSV bulk import failed'));
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Employee Directory & Onboarding</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Oversee staff profiles, provision credentials, run batch CSV dry-run validation, and inspect 360 files
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCsvValidation(null);
              setCsvFile(null);
              setCsvModal(true);
            }}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import CSV
          </Button>

          <Button size="sm" onClick={() => setRegisterModal(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Register Employee
          </Button>
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

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name, employee code, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadEmployees()}
              className="text-xs h-9"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Probation">Probation</option>
            <option value="Exited">Exited</option>
          </select>

          <Button size="sm" onClick={() => loadEmployees()}>
            <Search className="h-3.5 w-3.5 mr-1" /> Filter
          </Button>
        </div>
      </Card>

      {/* Employees Table */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Total Registered Staff ({total})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="py-2.5 px-3 font-medium">Employee</th>
                <th className="py-2.5 px-3 font-medium">Department</th>
                <th className="py-2.5 px-3 font-medium">Designation</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium text-right">Basic Salary</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <Spinner size="md" />
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No employees found matching criteria
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{emp.full_name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{emp.email}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{emp.employee_code}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{emp.department_name || 'General'}</td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{emp.designation_title || 'Staff'}</td>
                    <td className="py-3 px-3">
                      <Badge className={getStatusColor(emp.status)}>{emp.status}</Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(emp.basic_salary)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpen360(emp.id)}
                        className="text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        360 View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-400">Page {page}</span>
          <div className="space-x-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={employees.length < 15} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Register Employee Modal */}
      {registerModal && (
        <Modal isOpen={registerModal} onClose={() => setRegisterModal(false)} title="Register New Employee">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Full Name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jane Doe"
                required
              />
              <Input
                label="Work Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@company.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+92 300 0000000"
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unspecified">Unspecified</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  className="w-full text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
                <select
                  value={form.designation_id}
                  onChange={(e) => setForm({ ...form, designation_id: e.target.value })}
                  className="w-full text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select Designation</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Joining Date"
                type="date"
                value={form.joining_date}
                onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                required
              />
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="Active">Active</option>
                  <option value="Probation">Probation</option>
                  <option value="Exited">Exited</option>
                </select>
              </div>
              <Input
                label="Basic Salary (PKR)"
                type="number"
                value={form.basic_salary}
                onChange={(e) => setForm({ ...form, basic_salary: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setRegisterModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Employee</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Temporary Password Modal */}
      {tempPwdModal && (
        <Modal
          isOpen={tempPwdModal}
          onClose={() => setTempPwdModal(false)}
          title="Employee Registered Successfully"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
              Login account provisioned and onboarding email dispatched. Copy the temporary password below for live demonstration access.
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Employee Code:</span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">{tempPwdInfo.code}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Name:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{tempPwdInfo.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Email:</span>
                <span className="font-semibold font-mono text-gray-900 dark:text-white">{tempPwdInfo.email}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block mb-1">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tempPwdInfo.password}
                    className="flex-1 bg-white dark:bg-gray-950 font-mono text-sm px-3 py-2 border border-gray-200 dark:border-gray-800 rounded text-emerald-600 dark:text-emerald-400 font-bold"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPwdInfo.password);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    variant="outline"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setTempPwdModal(false)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* CSV Import Modal with Dry Run */}
      {csvModal && (
        <Modal isOpen={csvModal} onClose={() => setCsvModal(false)} title="Bulk CSV Import with Dry-Run Validation">
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Upload an employee roster CSV file. The system runs an automated dry-run validation checking required fields, email syntax, unique codes, and positive salaries before any persistence occurs.
            </p>

            <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-center space-y-2">
              <FileSpreadsheet className="h-8 w-8 text-blue-600 mx-auto" />
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setCsvFile(e.target.files?.[0] || null);
                  setCsvValidation(null);
                }}
                className="text-xs text-gray-500"
              />
            </div>

            {csvFile && !csvValidation && (
              <Button onClick={handleCsvDryRun} disabled={csvLoading} className="w-full">
                {csvLoading ? <Spinner size="sm" className="mr-1.5" /> : null}
                Run Pre-Flight Dry Run
              </Button>
            )}

            {csvValidation && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border text-xs">
                  <span>Total Rows: <strong>{csvValidation.total_rows}</strong></span>
                  <span className="text-emerald-600">Valid: <strong>{csvValidation.valid_count}</strong></span>
                  <span className="text-rose-600">Errors: <strong>{csvValidation.error_count}</strong></span>
                </div>

                {csvValidation.errors?.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-rose-200 dark:border-rose-900 rounded-lg p-2 bg-rose-50/50 dark:bg-rose-950/20 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                    <p className="font-semibold text-rose-900 dark:text-rose-200">Validation Failures Found:</p>
                    {csvValidation.errors.map((err: any, idx: number) => (
                      <p key={idx} className="text-[11px]">
                        • Row {err.row} [{err.field}]: {err.reason}
                      </p>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                    ✓ All rows successfully validated with zero discrepancies. Ready to commit!
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setCsvModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCsvCommit}
                    disabled={csvLoading || csvValidation.error_count > 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {csvLoading ? <Spinner size="sm" className="mr-1.5" /> : null}
                    Commit Import to Database
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Employee 360 Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-950 shadow-2xl h-full flex flex-col z-10 border-l border-gray-200 dark:border-gray-800">
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Employee 360° Profile</h2>
                <p className="text-xs text-gray-400 font-mono">{profile360?.profile?.employee_code}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loading360 ? (
                <div className="py-20 text-center">
                  <Spinner size="lg" />
                </div>
              ) : profile360 ? (
                <>
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Personal Details</h3>
                    <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs">
                      <div>
                        <span className="text-gray-500 block">Name:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {profile360.profile.full_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Email:</span>
                        <span className="font-semibold font-mono">{profile360.profile.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Department:</span>
                        <span>{profile360.profile.department_name || 'General'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Joining Date:</span>
                        <span>{formatDate(profile360.profile.joining_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Salary Structure */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Compensation Matrix</h3>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                        <span className="text-gray-500 text-[10px] block">Basic</span>
                        <span className="font-bold font-mono">
                          {formatCurrency(profile360.salary_breakdown.basic_salary)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                        <span className="text-gray-500 text-[10px] block">HRA (40%)</span>
                        <span className="font-bold font-mono">
                          {formatCurrency(profile360.salary_breakdown.hra_estimate)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 text-emerald-800 dark:text-emerald-300">
                        <span className="text-[10px] block font-semibold">Gross Disbursed</span>
                        <span className="font-bold font-mono">
                          {formatCurrency(profile360.salary_breakdown.gross_salary_estimate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Analytics */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Attendance Summary</h3>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded text-emerald-700">
                        <span className="font-bold text-base block">{profile360.attendance_summary.present_days}</span>
                        <span className="text-[10px]">Present</span>
                      </div>
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-amber-700">
                        <span className="font-bold text-base block">{profile360.attendance_summary.late_days}</span>
                        <span className="text-[10px]">Late</span>
                      </div>
                      <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded text-orange-700">
                        <span className="font-bold text-base block">{profile360.attendance_summary.half_days}</span>
                        <span className="text-[10px]">Half Day</span>
                      </div>
                      <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded text-rose-700">
                        <span className="font-bold text-base block">{profile360.attendance_summary.absent_days}</span>
                        <span className="text-[10px]">Absent</span>
                      </div>
                    </div>
                  </div>

                  {/* Leave Quota Usage */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Leave Balances</h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-gray-600 mb-1">
                          <span>Annual Leave</span>
                          <span>
                            {profile360.leave_balances.annual.remaining} / {profile360.leave_balances.annual.quota} days left
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{
                              width: `${(profile360.leave_balances.annual.used / profile360.leave_balances.annual.quota) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-gray-600 mb-1">
                          <span>Sick Leave</span>
                          <span>
                            {profile360.leave_balances.sick.remaining} / {profile360.leave_balances.sick.quota} days left
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                          <div
                            className="bg-purple-600 h-1.5 rounded-full"
                            style={{
                              width: `${(profile360.leave_balances.sick.used / profile360.leave_balances.sick.quota) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-gray-600 mb-1">
                          <span>Casual Leave</span>
                          <span>
                            {profile360.leave_balances.casual.remaining} / {profile360.leave_balances.casual.quota} days left
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full"
                            style={{
                              width: `${(profile360.leave_balances.casual.used / profile360.leave_balances.casual.quota) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
