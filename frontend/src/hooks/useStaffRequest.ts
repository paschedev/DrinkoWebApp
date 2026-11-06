'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { api, ApiError } from '@/lib/api';

// Igual que api(), pero si la sesión venció manda al login.
export function useStaffRequest() {
  const router = useRouter();
  return useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }) => {
      try {
        return await api<T>(path, init);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) router.replace('/login');
        throw error;
      }
    },
    [router],
  );
}
