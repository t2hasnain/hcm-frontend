'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Mail, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { extractErrorMessage } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import api from '@/lib/api';

export default function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Mode: 'old_password' | 'email_otp'
  const [method, setMethod] = useState<'old_password' | 'email_otp'>('old_password');

  // Form states
  const [oldPasswordForm, setOldPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm: '',
  });

  const [otpForm, setOtpForm] = useState({
    email: user?.email || '',
    otp_code: '',
    new_password: '',
    confirm: '',
  });

  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOldPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!oldPasswordForm.old_password) errs.old_password = 'Current password is required';
    if (!oldPasswordForm.new_password) errs.new_password = 'New password is required';
    if (oldPasswordForm.new_password.length < 8) errs.new_password = 'Minimum 8 characters required';
    if (oldPasswordForm.new_password !== oldPasswordForm.confirm) errs.confirm = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await api.post('/api/v1/auth/change-password', {
        old_password: oldPasswordForm.old_password,
        new_password: oldPasswordForm.new_password,
      });
      toast('success', 'Password Updated', 'Your account password has been successfully updated.');
      if (user) {
        setUser({ ...user, must_change_password: false });
        if (user.role === 'Admin') router.push('/admin');
        else if (user.role === 'HR') router.push('/hr');
        else router.push('/employee');
      } else {
        router.push('/login');
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Could not change password');
      toast('error', 'Update Failed', msg);
      setErrors({ old_password: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!otpForm.email) {
      setErrors({ email: 'Please provide your account email' });
      return;
    }
    setSendingOtp(true);
    setErrors({});
    try {
      const { data } = await api.post('/api/v1/auth/request-otp', {
        email: otpForm.email,
      });
      setOtpSent(true);
      toast('success', 'Security Code Sent', data.message || 'Check your email inbox for the 4-digit code.');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to request security code');
      toast('error', 'Request Failed', msg);
      setErrors({ email: msg });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!otpForm.email) errs.email = 'Email is required';
    if (!otpForm.otp_code || otpForm.otp_code.trim().length < 4) errs.otp_code = 'Enter the 4-digit verification code';
    if (!otpForm.new_password) errs.new_password = 'New password is required';
    if (otpForm.new_password.length < 8) errs.new_password = 'Minimum 8 characters required';
    if (otpForm.new_password !== otpForm.confirm) errs.confirm = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      await api.post('/api/v1/auth/verify-otp-change-password', {
        email: otpForm.email.trim(),
        otp_code: otpForm.otp_code.trim(),
        new_password: otpForm.new_password,
      });
      toast('success', 'Verification Succeeded', 'Your password was verified and updated successfully.');
      if (user) {
        setUser({ ...user, must_change_password: false });
        if (user.role === 'Admin') router.push('/admin');
        else if (user.role === 'HR') router.push('/hr');
        else router.push('/employee');
      } else {
        router.push('/login');
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Verification failed');
      toast('error', 'Error', msg);
      setErrors({ otp_code: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo variant="full" size="md" className="mb-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Update Account Password</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Choose your preferred authentication method to set a permanent secure password.
          </p>
        </div>

        {/* Method Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl mb-4 border border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => { setMethod('old_password'); setErrors({}); }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              method === 'old_password'
                ? 'bg-white dark:bg-gray-800 text-[#0066FF] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Current Password
          </button>
          <button
            type="button"
            onClick={() => { setMethod('email_otp'); setErrors({}); }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg transition-all ${
              method === 'email_otp'
                ? 'bg-white dark:bg-gray-800 text-[#0066FF] shadow-xs'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Mail className="h-4 w-4" />
            4-Digit Email Code
          </button>
        </div>

        <Card className="shadow-lg border-gray-200 dark:border-gray-800">
          {method === 'old_password' ? (
            /* Method A: Old Password */
            <form onSubmit={handleOldPasswordSubmit} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={oldPasswordForm.old_password}
                onChange={(e) => {
                  setOldPasswordForm({ ...oldPasswordForm, old_password: e.target.value });
                  setErrors({ ...errors, old_password: '' });
                }}
                placeholder="Enter current password"
                error={errors.old_password}
              />
              <Input
                label="New Password"
                type="password"
                value={oldPasswordForm.new_password}
                onChange={(e) => {
                  setOldPasswordForm({ ...oldPasswordForm, new_password: e.target.value });
                  setErrors({ ...errors, new_password: '' });
                }}
                placeholder="At least 8 characters"
                error={errors.new_password}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={oldPasswordForm.confirm}
                onChange={(e) => {
                  setOldPasswordForm({ ...oldPasswordForm, confirm: e.target.value });
                  setErrors({ ...errors, confirm: '' });
                }}
                placeholder="Repeat new password"
                error={errors.confirm}
              />
              <Button type="submit" loading={loading} className="w-full">
                Save New Password
              </Button>
            </form>
          ) : (
            /* Method B: 4-Digit Email OTP */
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Registered Work Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={otpForm.email}
                    onChange={(e) => {
                      setOtpForm({ ...otpForm, email: e.target.value });
                      setErrors({ ...errors, email: '' });
                    }}
                    placeholder="you@company.com"
                    className="flex-1 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    loading={sendingOtp}
                    onClick={handleRequestOtp}
                    className="text-xs shrink-0"
                  >
                    {otpSent ? 'Resend Code' : 'Send Code'}
                  </Button>
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                {otpSent && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    A 4-digit code was sent to your email. Valid for 10 minutes.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  4-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpForm.otp_code}
                  onChange={(e) => {
                    setOtpForm({ ...otpForm, otp_code: e.target.value });
                    setErrors({ ...errors, otp_code: '' });
                  }}
                  placeholder="e.g. 5821"
                  className="w-full text-center tracking-widest text-lg font-mono px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-[#0066FF] font-bold focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
                {errors.otp_code && <p className="text-xs text-red-500 mt-1">{errors.otp_code}</p>}
              </div>

              <Input
                label="New Password"
                type="password"
                value={otpForm.new_password}
                onChange={(e) => {
                  setOtpForm({ ...otpForm, new_password: e.target.value });
                  setErrors({ ...errors, new_password: '' });
                }}
                placeholder="At least 8 characters"
                error={errors.new_password}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={otpForm.confirm}
                onChange={(e) => {
                  setOtpForm({ ...otpForm, confirm: e.target.value });
                  setErrors({ ...errors, confirm: '' });
                }}
                placeholder="Repeat new password"
                error={errors.confirm}
              />

              <Button type="submit" loading={loading} className="w-full">
                Verify Code & Update Password
              </Button>
            </form>
          )}

          {/* Security policy note */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <ShieldCheck className="h-4 w-4 text-[#0066FF] shrink-0 mt-0.5" />
            <span>
              <strong>Security Protocol:</strong> Employees can submit up to 3 password update requests per day. HR accounts are limited to 5 daily requests.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
