'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Settings, MapPin, Shield, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { extractErrorMessage } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { ImageUpload } from '@/components/ui/ImageUpload';
import api from '@/lib/api';

interface FormData {
  company_name: string;
  logo_url: string;
  office_start_time: string;
  grace_minutes: number;
  half_day_hours: number;
  weekend_days: string[];
  office_lat: number | string;
  office_lng: number | string;
  geofence_radius_m: number;
  admin_email: string;
  admin_password: string;
  admin_name: string;
  confirm_password: string;
}

const steps = [
  { title: 'Company Info', icon: Building2 },
  { title: 'Office Settings', icon: Settings },
  { title: 'Geofencing', icon: MapPin },
  { title: 'Admin Setup', icon: Shield },
];

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormData>({
    company_name: '',
    logo_url: '',
    office_start_time: '09:00',
    grace_minutes: 15,
    half_day_hours: 4,
    weekend_days: ['Saturday', 'Sunday'],
    office_lat: '',
    office_lng: '',
    geofence_radius_m: 150,
    admin_email: '',
    admin_password: '',
    admin_name: '',
    confirm_password: '',
  });

  const set = (field: keyof FormData, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const toggleWeekend = (day: string) => {
    const current = form.weekend_days;
    if (current.includes(day)) {
      set('weekend_days', current.filter((d) => d !== day));
    } else {
      set('weekend_days', [...current, day]);
    }
  };

  const useMyLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('office_lat', pos.coords.latitude);
        set('office_lng', pos.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        toast('error', 'Location denied', 'Could not get your current location');
        setGeoLoading(false);
      }
    );
  };

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    if (step === 0 && !form.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }
    if (step === 2) {
      if (!form.office_lat) newErrors.office_lat = 'Latitude is required';
      if (!form.office_lng) newErrors.office_lng = 'Longitude is required';
    }
    if (step === 3) {
      if (!form.admin_email) newErrors.admin_email = 'Email is required';
      if (!form.admin_name) newErrors.admin_name = 'Name is required';
      if (!form.admin_password) newErrors.admin_password = 'Password is required';
      if (form.admin_password !== form.confirm_password) newErrors.confirm_password = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    try {
      const payload = {
        company_name: form.company_name,
        logo_url: form.logo_url || null,
        office_start_time: form.office_start_time,
        grace_minutes: Number(form.grace_minutes),
        half_day_hours: Number(form.half_day_hours),
        weekend_days: form.weekend_days,
        office_lat: form.office_lat !== '' ? Number(form.office_lat) : null,
        office_lng: form.office_lng !== '' ? Number(form.office_lng) : null,
        geofence_radius_m: Number(form.geofence_radius_m),
        admin_email: form.admin_email,
        admin_password: form.admin_password,
        admin_name: form.admin_name,
      };
      const { data } = await api.post('/api/v1/auth/first-run', payload);
      localStorage.setItem('hcm_token', data.access_token);
      const userData = {
        user_id: data.user_id,
        email: data.email,
        role: data.role,
        must_change_password: false,
        full_name: form.admin_name,
      };
      localStorage.setItem('hcm_user', JSON.stringify(userData));
      toast('success', 'Setup complete!', 'Welcome to HCM Lite');
      router.push('/admin');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Please check your inputs');
      toast('error', 'Setup failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo variant="full" size="lg" className="mb-2" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">First-Run Organization Setup</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Configure company working rules, office geofence perimeter, and primary administrator.</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <React.Fragment key={s.title}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-colors
                    ${i < step ? 'bg-blue-600 border-blue-600 text-white'
                      : i === step ? 'border-blue-600 text-blue-600 bg-white dark:bg-gray-900'
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900'
                    }`}>
                    {i < step ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{s.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-800'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {steps[step].title}
          </h2>

          {/* Step 0: Company Info */}
          {step === 0 && (
            <div className="space-y-4">
              <Input
                label="Company Name *"
                value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Acme Corp"
                error={errors.company_name}
              />
              <ImageUpload
                label="Company Logo (Optional)"
                value={form.logo_url}
                onChange={(url) => set('logo_url', url)}
                helper="Upload your company logo. Hosted automatically on ImgBB CDN."
              />
            </div>
          )}

          {/* Step 1: Office Settings */}
          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Office Start Time"
                type="time"
                value={form.office_start_time}
                onChange={(e) => set('office_start_time', e.target.value)}
              />
              <Input
                label="Grace Period (minutes)"
                type="number"
                value={form.grace_minutes}
                onChange={(e) => set('grace_minutes', e.target.value)}
                min={0}
              />
              <Input
                label="Half Day Hours"
                type="number"
                value={form.half_day_hours}
                onChange={(e) => set('half_day_hours', e.target.value)}
                min={1}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Weekend Days</label>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekend(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        form.weekend_days.includes(day)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Geofencing */}
          {step === 2 && (
            <div className="space-y-4">
              <Button
                variant="secondary"
                onClick={useMyLocation}
                loading={geoLoading}
                type="button"
              >
                <MapPin className="h-4 w-4" />
                Use My Location
              </Button>
              <Input
                label="Office Latitude *"
                type="number"
                step="any"
                value={form.office_lat as string}
                onChange={(e) => set('office_lat', e.target.value)}
                placeholder="24.8607"
                error={errors.office_lat}
              />
              <Input
                label="Office Longitude *"
                type="number"
                step="any"
                value={form.office_lng as string}
                onChange={(e) => set('office_lng', e.target.value)}
                placeholder="67.0011"
                error={errors.office_lng}
              />
              <Input
                label="Geofence Radius (meters)"
                type="number"
                value={form.geofence_radius_m}
                onChange={(e) => set('geofence_radius_m', e.target.value)}
                min={50}
              />
            </div>
          )}

          {/* Step 3: Admin Credentials */}
          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Admin Full Name *"
                value={form.admin_name}
                onChange={(e) => set('admin_name', e.target.value)}
                placeholder="John Doe"
                error={errors.admin_name}
              />
              <Input
                label="Admin Email *"
                type="email"
                value={form.admin_email}
                onChange={(e) => set('admin_email', e.target.value)}
                placeholder="admin@company.com"
                error={errors.admin_email}
              />
              <Input
                label="Password *"
                type="password"
                value={form.admin_password}
                onChange={(e) => set('admin_password', e.target.value)}
                placeholder="••••••••"
                error={errors.admin_password}
              />
              <Input
                label="Confirm Password *"
                type="password"
                value={form.confirm_password}
                onChange={(e) => set('confirm_password', e.target.value)}
                placeholder="••••••••"
                error={errors.confirm_password}
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={next}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={submit} loading={loading}>
                Complete Setup
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
