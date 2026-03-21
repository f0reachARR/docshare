'use client';

import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'member';
}

interface AuthContextValue {
  user: AuthUser | null;
  organizations: AuthOrganization[];
  activeOrganizationId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  organizations: [],
  activeOrganizationId: null,
  isLoading: true,
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const result = await apiClient.GET('/api/me');
      if (result.response.status === 401) return null;
      return throwIfError(result);
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data?.data?.user
        ? {
            id: data.data.user.id,
            email: data.data.user.email,
            name: data.data.user.name,
            isAdmin: data.data.user.isAdmin ?? false,
          }
        : null,
      organizations: (data?.data?.organizations ?? []) as AuthOrganization[],
      activeOrganizationId: data?.data?.activeOrganizationId ?? null,
      isLoading,
      isAuthenticated: !!data?.data?.user,
    }),
    [data, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useInvalidateMe() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.me });
}
