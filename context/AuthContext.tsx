'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';

interface User {
  user_id: number;
  email: string;
  role: 'Admin' | 'HR' | 'Employee';
  must_change_password: boolean;
  employee_id?: number;
  employee_code?: string;
  full_name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/api/v1/auth/status');
        setIsInitialized(data.is_initialized);
        if (!data.is_initialized) {
          if (pathname !== '/setup') router.replace('/setup');
          setIsLoading(false);
          return;
        }
      } catch {
        setIsLoading(false);
        return;
      }

      const storedToken = localStorage.getItem('hcm_token');
      const storedUser = localStorage.getItem('hcm_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUserState(JSON.parse(storedUser));
      }
      setIsLoading(false);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/api/v1/auth/login', { email, password });
    localStorage.setItem('hcm_token', data.access_token);
    const userData: User = {
      user_id: data.user_id,
      email: data.email,
      role: data.role,
      must_change_password: data.must_change_password,
      employee_id: data.employee_id,
      employee_code: data.employee_code,
      full_name: data.full_name,
    };
    localStorage.setItem('hcm_user', JSON.stringify(userData));
    setToken(data.access_token);
    setUserState(userData);
    if (data.must_change_password) {
      router.push('/change-password');
    } else if (data.role === 'Admin') {
      router.push('/admin');
    } else if (data.role === 'HR') {
      router.push('/hr');
    } else {
      router.push('/employee');
    }
  };

  const logout = () => {
    localStorage.removeItem('hcm_token');
    localStorage.removeItem('hcm_user');
    setToken(null);
    setUserState(null);
    router.push('/login');
  };

  const setUser = (u: User) => {
    setUserState(u);
    localStorage.setItem('hcm_user', JSON.stringify(u));
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isInitialized, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
