'use client';
import React, { useState, useEffect } from 'react';
import { UserPlus, KeyRound, UserCheck, UserX, Copy, Check, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, extractErrorMessage } from '@/lib/utils';

interface EmployeeUser {
  id: number;
  user_id: number;
  employee_code: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  is_active: boolean;
  department_name?: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<EmployeeUser[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: number; title: string; department_id: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Messages
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // HR Modal
  const [createHrModal, setCreateHrModal] = useState(false);
  const [hrForm, setHrForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    department_id: '',
    designation_id: '',
    basic_salary: 75000,
  });

  // Generated Temp Password Modal
  const [tempPwdModal, setTempPwdModal] = useState(false);
  const [tempPwdData, setTempPwdData] = useState<{ email: string; temp_password: string; role: string }>({
    email: '',
    temp_password: '',
    role: '',
  });
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [resEmp, resDept, resDes] = await Promise.all([
        api.get('/api/v1/employees?limit=100'),
        api.get('/api/v1/setup/departments').catch(() => ({ data: [] })),
        api.get('/api/v1/setup/designations').catch(() => ({ data: [] })),
      ]);
      setUsers(resEmp.data?.items || []);
      setDepartments(resDept.data || []);
      setDesignations(resDes.data || []);
    } catch (err: any) {
      setErrorMsg('Failed to load user directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateHR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        email: hrForm.email,
        full_name: hrForm.full_name,
        phone: hrForm.phone || undefined,
        basic_salary: Number(hrForm.basic_salary),
      };
      if (hrForm.department_id) payload.department_id = Number(hrForm.department_id);
      if (hrForm.designation_id) payload.designation_id = Number(hrForm.designation_id);

      const res = await api.post('/api/v1/setup/hr-users', payload);
      setCreateHrModal(false);
      setHrForm({
        email: '',
        full_name: '',
        phone: '',
        department_id: '',
        designation_id: '',
        basic_salary: 75000,
      });

      // Show temporary password modal
      setTempPwdData({
        email: res.data.email,
        temp_password: res.data.temporary_password,
        role: 'HR Manager',
      });
      setTempPwdModal(true);
      loadData();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to create HR account'));
    }
  };

  const handleToggleStatus = async (userId: number, currentActive: boolean) => {
    try {
      await api.patch(`/api/v1/setup/users/${userId}/status`, {
        is_active: !currentActive,
      });
      setSuccessMsg(`User login ${!currentActive ? 'activated' : 'deactivated'}`);
      setTimeout(() => setSuccessMsg(''), 3000);
      loadData();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Could not update user status'));
    }
  };

  const handleResetPassword = async (userId: number, email: string) => {
    if (!confirm(`Generate a new temporary password and force password reset for ${email}?`)) return;
    try {
      const res = await api.patch(`/api/v1/setup/users/${userId}/reset-password`);
      setTempPwdData({
        email: res.data.email,
        temp_password: res.data.temporary_password,
        role: 'Employee / HR',
      });
      setTempPwdModal(true);
      loadData();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Password reset failed'));
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPwdData.temp_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">User & Access Management</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Provision HR administrators, oversee active logins, toggle account access, and dispatch password resets
          </p>
        </div>

        <Button onClick={() => setCreateHrModal(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Provision HR Login
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

      {/* Users Table */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Active System Credentials ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="py-2.5 px-3 font-medium">Employee</th>
                <th className="py-2.5 px-3 font-medium">Role</th>
                <th className="py-2.5 px-3 font-medium">Department</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Registered</th>
                <th className="py-2.5 px-3 font-medium text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <Spinner size="md" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No active users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{u.full_name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{u.email}</p>
                      <p className="text-[10px] text-gray-500">{u.employee_code}</p>
                    </td>

                    <td className="py-3 px-3">
                      <Badge
                        className={
                          u.role === 'Admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : u.role === 'HR'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                        }
                      >
                        {u.role}
                      </Badge>
                    </td>

                    <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{u.department_name || 'General'}</td>

                    <td className="py-3 px-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-500 text-xs font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Suspended
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-gray-400">{formatDate(u.created_at)}</td>

                    <td className="py-3 px-3 text-right space-x-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetPassword(u.user_id, u.email)}
                        title="Force Temporary Password Reset"
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs py-1 px-2 h-7"
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-1" />
                        Reset
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(u.user_id, u.is_active)}
                        className={`text-xs py-1 px-2 h-7 ${
                          u.is_active
                            ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        {u.is_active ? (
                          <>
                            <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5 mr-1" /> Activate
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Provision HR Modal */}
      {createHrModal && (
        <Modal isOpen={createHrModal} onClose={() => setCreateHrModal(false)} title="Provision HR Administrator">
          <form onSubmit={handleCreateHR} className="space-y-4">
            <Input
              label="Work Email"
              type="email"
              value={hrForm.email}
              onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
              placeholder="hr.director@company.com"
              required
            />
            <Input
              label="Full Name"
              value={hrForm.full_name}
              onChange={(e) => setHrForm({ ...hrForm, full_name: e.target.value })}
              placeholder="e.g. Sarah Jenkins"
              required
            />
            <Input
              label="Phone Number"
              value={hrForm.phone}
              onChange={(e) => setHrForm({ ...hrForm, phone: e.target.value })}
              placeholder="+92 300 1234567"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
                <select
                  value={hrForm.department_id}
                  onChange={(e) => setHrForm({ ...hrForm, department_id: e.target.value })}
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
                  value={hrForm.designation_id}
                  onChange={(e) => setHrForm({ ...hrForm, designation_id: e.target.value })}
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
            <Input
              label="Basic Salary (PKR)"
              type="number"
              value={hrForm.basic_salary}
              onChange={(e) => setHrForm({ ...hrForm, basic_salary: parseFloat(e.target.value) || 0 })}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setCreateHrModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Create HR Login</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Temporary Password Display Modal (For Live Demos) */}
      {tempPwdModal && (
        <Modal
          isOpen={tempPwdModal}
          onClose={() => setTempPwdModal(false)}
          title="Account Credentials Generated"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              An invitation email has been dispatched via Azure Communication Services. You may also copy the temporary password below for immediate portal access during testing.
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Email:</span>
                <span className="font-semibold text-gray-900 dark:text-white font-mono">{tempPwdData.email}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Role:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{tempPwdData.role}</span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <span className="text-xs text-gray-500 block mb-1">Temporary Password:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tempPwdData.temp_password}
                    className="flex-1 bg-white dark:bg-gray-950 font-mono text-sm px-3 py-2 border border-gray-200 dark:border-gray-800 rounded text-blue-600 dark:text-blue-400 font-bold"
                  />
                  <Button size="sm" onClick={copyToClipboard} variant="outline">
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
    </div>
  );
}
