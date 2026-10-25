'use client';
import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  MapPin,
  Mail,
  Building,
  Briefcase,
  Calendar,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Shield,
  BadgeCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, extractErrorMessage } from '@/lib/utils';

interface EmployeeProfile {
  id: number;
  user_id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  department_name?: string;
  designation_title?: string;
  joining_date: string;
  status: string;
  basic_salary: number;
}

export default function EmployeeProfilePage() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const resDash = await api.get('/api/v1/analytics/employee');
      const empId = resDash.data?.employee_id;
      if (empId) {
        const res360 = await api.get(`/api/v1/employees/${empId}/360`);
        const p = res360.data?.profile;
        setProfile(p);
        setPhone(p?.phone || '');
        setAddress(p?.address || '');
      }
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to load employee profile'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Employees are strictly restricted to updating phone & address
      await api.put(`/api/v1/employees/${profile.id}`, {
        phone: phone.trim(),
        address: address.trim(),
      });
      setSuccessMsg('Your personal contact details have been updated successfully.');
      setTimeout(() => setSuccessMsg(''), 5000);
      loadData();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, 'Failed to update contact details'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <span className="text-sm text-gray-500">Loading your profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          Employee Profile & Self-Service Records
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          View organizational assignment details and manage your active contact information
        </p>
      </div>

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

      {/* Profile Overview Card */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black border border-white/30 shadow-inner">
              {profile?.full_name?.charAt(0) || 'E'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold">{profile?.full_name}</h2>
                <Badge variant="blue" className="bg-white/20 text-white border-white/20 py-0.5 text-xs">
                  {profile?.status || 'Active'}
                </Badge>
              </div>
              <p className="text-xs text-blue-100 font-mono mt-0.5">
                ID: {profile?.employee_code} • {profile?.email}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-blue-200">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  {profile?.designation_title || 'Employee'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5" />
                  {profile?.department_name || 'General'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-blue-100 bg-white/10 backdrop-blur-xs p-3 rounded-xl border border-white/20">
            <div>Joined Organization</div>
            <div className="font-semibold text-white mt-0.5">{formatDate(profile?.joining_date || null)}</div>
          </div>
        </div>
      </Card>

      {/* Editable Contact Details Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-600" />
              Editable Contact Details
            </h2>
            <p className="text-xs text-gray-500">You have permission to self-update your phone number and mailing address</p>
          </div>
          <Badge variant="green" className="text-xs">
            Self-Managed
          </Badge>
        </div>

        <form onSubmit={handleSaveContact} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +92 300 1234567"
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Gender
              </label>
              <input
                type="text"
                value={profile?.gender || 'Not specified'}
                disabled
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Residential / Mailing Address
            </label>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your current residential address..."
              className="w-full text-xs p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-5 shadow-sm"
            >
              {isSaving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              <span>Save Contact Changes</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* RBAC-Locked Organizational Fields */}
      <Card className="border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Institutional Records & Job Architecture
            </h2>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
            Protected by RBAC
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          These official records are strictly managed by HR Administration. To request modifications to your job title, department assignment, or compensation, contact HR.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-400 block mb-1">Assigned Department</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              {profile?.department_name || 'General Department'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-400 block mb-1">Designation Title</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              {profile?.designation_title || 'Associate'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-gray-400 block mb-1">Corporate Email</span>
            <span className="font-bold text-gray-900 dark:text-white text-sm truncate block">
              {profile?.email}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
