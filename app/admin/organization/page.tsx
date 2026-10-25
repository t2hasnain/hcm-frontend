'use client';
import React, { useState, useEffect } from 'react';
import { Building2, Briefcase, Calendar, Settings as SettingsIcon, Plus, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { formatDate, extractErrorMessage } from '@/lib/utils';

interface CompanySettings {
  id: number;
  company_name: string;
  logo_url?: string;
  office_start_time: string;
  grace_minutes: number;
  half_day_hours: number;
  weekend_days: string[];
  office_lat?: number;
  office_lng?: number;
  geofence_radius_m: number;
  annual_leave_quota: number;
  sick_leave_quota: number;
  casual_leave_quota: number;
}

interface Department {
  id: number;
  name: string;
  description?: string;
  employee_count?: number;
}

interface Designation {
  id: number;
  title: string;
  department_id: number;
  department_name?: string;
}

interface PublicHoliday {
  id: number;
  title: string;
  date: string;
}

export default function OrganizationPage() {
  const [activeTab, setActiveTab] = useState<'company' | 'departments' | 'designations' | 'holidays'>('company');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);

  // Feedback states
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [deptModal, setDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ id: 0, name: '', description: '' });

  const [desigModal, setDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ id: 0, title: '', department_id: 0 });

  const [holidayModal, setHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ id: 0, title: '', date: '' });

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [resC, resDept, resDes, resHol] = await Promise.all([
        api.get('/api/v1/setup/company'),
        api.get('/api/v1/setup/departments'),
        api.get('/api/v1/setup/designations'),
        api.get('/api/v1/setup/holidays'),
      ]);
      setCompany(resC.data);
      setDepartments(resDept.data || []);
      setDesignations(resDes.data || []);
      setHolidays(resHol.data || []);
    } catch (err: any) {
      setErrorMsg('Failed to load organizational configuration');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // 1. Company Save
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    try {
      const res = await api.put('/api/v1/setup/company', company);
      setCompany(res.data);
      showSuccess('Company rules and parameters updated successfully');
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to update company settings'));
    }
  };

  // 2. Department Actions
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (deptForm.id) {
        await api.put(`/api/v1/setup/departments/${deptForm.id}`, {
          name: deptForm.name,
          description: deptForm.description,
        });
        showSuccess('Department updated');
      } else {
        await api.post('/api/v1/setup/departments', {
          name: deptForm.name,
          description: deptForm.description,
        });
        showSuccess('Department created');
      }
      setDeptModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Department operation failed'));
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    if (!confirm('Are you sure you want to remove this department?')) return;
    try {
      await api.delete(`/api/v1/setup/departments/${id}`);
      showSuccess('Department removed');
      loadAll();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Cannot delete department'));
    }
  };

  // 3. Designation Actions
  const handleSaveDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (desigForm.id) {
        await api.put(`/api/v1/setup/designations/${desigForm.id}`, {
          title: desigForm.title,
          department_id: Number(desigForm.department_id),
        });
        showSuccess('Designation updated');
      } else {
        await api.post('/api/v1/setup/designations', {
          title: desigForm.title,
          department_id: Number(desigForm.department_id),
        });
        showSuccess('Designation created');
      }
      setDesigModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Designation operation failed'));
    }
  };

  const handleDeleteDesignation = async (id: number) => {
    if (!confirm('Are you sure you want to delete this designation?')) return;
    try {
      await api.delete(`/api/v1/setup/designations/${id}`);
      showSuccess('Designation deleted');
      loadAll();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Cannot delete designation'));
    }
  };

  // 4. Holiday Actions
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (holidayForm.id) {
        await api.put(`/api/v1/setup/holidays/${holidayForm.id}`, {
          title: holidayForm.title,
          date: holidayForm.date,
        });
        showSuccess('Holiday updated');
      } else {
        await api.post('/api/v1/setup/holidays', {
          title: holidayForm.title,
          date: holidayForm.date,
        });
        showSuccess('Holiday added to calendar');
      }
      setHolidayModal(false);
      loadAll();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to save holiday'));
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!confirm('Remove this public holiday?')) return;
    try {
      await api.delete(`/api/v1/setup/holidays/${id}`);
      showSuccess('Holiday removed');
      loadAll();
    } catch (err: any) {
      setErrorMsg(extractErrorMessage(err, 'Failed to delete holiday'));
    }
  };

  if (isLoading && !company) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Organization & System Rules</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Define working shifts, grace periods, geofencing coordinates, leave quotas, and departmental structure
        </p>
      </div>

      {/* Notifications */}
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
          onClick={() => setActiveTab('company')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'company'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          Company & Attendance Rules
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'departments'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Departments ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab('designations')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'designations'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Designations ({designations.length})
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
            activeTab === 'holidays'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Public Holidays ({holidays.length})
        </button>
      </div>

      {/* TAB 1: COMPANY SETTINGS */}
      {activeTab === 'company' && company && (
        <form onSubmit={handleSaveCompany} className="space-y-6 max-w-4xl">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">General Profile</h2>
            <div className="space-y-4">
              <Input
                label="Company Name"
                value={company.company_name}
                onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                required
              />
              <ImageUpload
                label="Company Logo"
                value={company.logo_url || ''}
                onChange={(url) => setCompany({ ...company, logo_url: url })}
                helper="Upload or update your official company logo via ImgBB CDN."
              />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Office Hours & Attendance Polices</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Shift Start Time (HH:MM)"
                value={company.office_start_time}
                onChange={(e) => setCompany({ ...company, office_start_time: e.target.value })}
                required
              />
              <Input
                label="Grace Minutes"
                type="number"
                value={company.grace_minutes}
                onChange={(e) => setCompany({ ...company, grace_minutes: parseInt(e.target.value) || 0 })}
                required
              />
              <Input
                label="Half Day Cutoff (Hours)"
                type="number"
                step="0.5"
                value={company.half_day_hours}
                onChange={(e) => setCompany({ ...company, half_day_hours: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Geofencing & Physical Location</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Office Latitude"
                type="number"
                step="any"
                value={company.office_lat ?? ''}
                onChange={(e) => setCompany({ ...company, office_lat: parseFloat(e.target.value) || undefined })}
              />
              <Input
                label="Office Longitude"
                type="number"
                step="any"
                value={company.office_lng ?? ''}
                onChange={(e) => setCompany({ ...company, office_lng: parseFloat(e.target.value) || undefined })}
              />
              <Input
                label="Geofence Radius (Meters)"
                type="number"
                value={company.geofence_radius_m}
                onChange={(e) => setCompany({ ...company, geofence_radius_m: parseFloat(e.target.value) || 150 })}
                required
              />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Annual Leave Quotas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Annual Leave (Days)"
                type="number"
                value={company.annual_leave_quota}
                onChange={(e) => setCompany({ ...company, annual_leave_quota: parseInt(e.target.value) || 0 })}
                required
              />
              <Input
                label="Sick Leave (Days)"
                type="number"
                value={company.sick_leave_quota}
                onChange={(e) => setCompany({ ...company, sick_leave_quota: parseInt(e.target.value) || 0 })}
                required
              />
              <Input
                label="Casual Leave (Days)"
                type="number"
                value={company.casual_leave_quota}
                onChange={(e) => setCompany({ ...company, casual_leave_quota: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit">Save Organizational Rules</Button>
          </div>
        </form>
      )}

      {/* TAB 2: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Company Departments</h2>
            <Button
              size="sm"
              onClick={() => {
                setDeptForm({ id: 0, name: '', description: '' });
                setDeptModal(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Department
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Department Name</th>
                  <th className="py-2.5 px-3 font-medium">Description</th>
                  <th className="py-2.5 px-3 font-medium text-center">Active Employees</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">{d.name}</td>
                    <td className="py-3 px-3 text-gray-500">{d.description || '—'}</td>
                    <td className="py-3 px-3 text-center">
                      <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {d.employee_count ?? 0}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setDeptForm({ id: d.id, name: d.name, description: d.description || '' });
                          setDeptModal(true);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(d.id)}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: DESIGNATIONS */}
      {activeTab === 'designations' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Job Titles & Designations</h2>
            <Button
              size="sm"
              onClick={() => {
                setDesigForm({ id: 0, title: '', department_id: departments[0]?.id || 0 });
                setDesigModal(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Designation
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Job Title</th>
                  <th className="py-2.5 px-3 font-medium">Department</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {designations.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">{d.title}</td>
                    <td className="py-3 px-3 text-gray-500">
                      <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {d.department_name || departments.find((dep) => dep.id === d.department_id)?.name || 'General'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setDesigForm({ id: d.id, title: d.title, department_id: d.department_id });
                          setDesigModal(true);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDesignation(d.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: PUBLIC HOLIDAYS */}
      {activeTab === 'holidays' && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Annual Public Holidays</h2>
            <Button
              size="sm"
              onClick={() => {
                setHolidayForm({ id: 0, title: '', date: '' });
                setHolidayModal(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Holiday
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Holiday Title</th>
                  <th className="py-2.5 px-3 font-medium">Date</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">{h.title}</td>
                    <td className="py-3 px-3 text-gray-500 font-mono">{formatDate(h.date)}</td>
                    <td className="py-3 px-3 text-right space-x-2">
                      <button
                        onClick={() => {
                          setHolidayForm({ id: h.id, title: h.title, date: h.date });
                          setHolidayModal(true);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Department Modal */}
      {deptModal && (
        <Modal isOpen={deptModal} onClose={() => setDeptModal(false)} title={deptForm.id ? 'Edit Department' : 'New Department'}>
          <form onSubmit={handleSaveDepartment} className="space-y-4">
            <Input
              label="Department Name"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              required
            />
            <Input
              label="Description"
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setDeptModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Department</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Designation Modal */}
      {desigModal && (
        <Modal isOpen={desigModal} onClose={() => setDesigModal(false)} title={desigForm.id ? 'Edit Designation' : 'New Designation'}>
          <form onSubmit={handleSaveDesignation} className="space-y-4">
            <Input
              label="Job Title"
              value={desigForm.title}
              onChange={(e) => setDesigForm({ ...desigForm, title: e.target.value })}
              required
            />
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
              <select
                value={desigForm.department_id}
                onChange={(e) => setDesigForm({ ...desigForm, department_id: Number(e.target.value) })}
                className="w-full text-xs h-9 px-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                required
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setDesigModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Designation</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Holiday Modal */}
      {holidayModal && (
        <Modal isOpen={holidayModal} onClose={() => setHolidayModal(false)} title={holidayForm.id ? 'Edit Holiday' : 'Add Holiday'}>
          <form onSubmit={handleSaveHoliday} className="space-y-4">
            <Input
              label="Holiday Title"
              value={holidayForm.title}
              onChange={(e) => setHolidayForm({ ...holidayForm, title: e.target.value })}
              required
            />
            <Input
              label="Date"
              type="date"
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" type="button" onClick={() => setHolidayModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Holiday</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
