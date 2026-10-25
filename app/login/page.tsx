'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Sparkles, ArrowRight, Lock, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/AuthContext';
import { extractErrorMessage } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email address is required';
    else if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Please enter a valid work email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Invalid credentials. Please verify your email and password.');
      setErrors({ general: msg });
      toast('error', 'Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo variant="full" size="lg" className="mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            Enterprise AI-Assisted Human Capital Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#0F172A] py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 dark:shadow-black/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 transition-all">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign in to your portal</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter your credentials to access Admin, HR, or Employee Self-Service.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {errors.general && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                <span className="font-semibold text-red-600">Error:</span>
                <span>{errors.general}</span>
              </div>
            )}

            <div>
              <Input
                label="Corporate Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({});
                }}
                placeholder="name@company.com"
                error={errors.email}
                required
              />
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors({});
                }}
                placeholder="••••••••••••"
                error={errors.password}
                required
              />
            </div>

            <div className="flex items-center justify-end">
              <Link
                href="/change-password"
                className="text-xs font-medium text-[#0066FF] hover:underline"
              >
                Reset or Change Password
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0066FF] hover:bg-[#0052CC] text-white py-2.5 rounded-xl font-semibold shadow-md shadow-blue-500/20 text-sm mt-2 transition-all"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          {/* Security footnote */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0066FF]" />
              Authorized Corporate Access
            </span>
            <span>Enterprise Security</span>
          </div>
        </div>

        {/* Footer Brand Statement */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-400 dark:text-slate-600">
            HCM Lite &bull; Smarter HR. Happier Teams.
          </p>
        </div>
      </div>
    </div>
  );
}
