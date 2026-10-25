'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FullPageSpinner } from '@/components/ui/Spinner';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('hcm_token');
    const user = localStorage.getItem('hcm_user');
    if (token && user) {
      try {
        const parsed = JSON.parse(user);
        if (parsed.role === 'Admin') router.replace('/admin');
        else if (parsed.role === 'HR') router.replace('/hr');
        else router.replace('/employee');
      } catch {
        router.replace('/login');
      }
    } else {
      router.replace('/login');
    }
  }, [router]);

  return <FullPageSpinner />;
}
