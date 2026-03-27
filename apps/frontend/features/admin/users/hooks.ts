import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminUsersQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: unknown;
  organizationCount: number;
};

export type Membership = {
  memberId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: 'owner' | 'member';
  createdAt: unknown;
};

export const listParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
  sort: parseAsString.withDefault('createdAt:desc'),
};

export function useAdminUsersPageState() {
  const [queryParams, setQueryParams] = useQueryStates(listParsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.users(queryParams),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/users', {
        params: {
          query: {
            page: queryParams.page,
            pageSize: queryParams.pageSize,
            q: queryParams.q || undefined,
            sort: queryParams.sort as
              | 'name:asc'
              | 'name:desc'
              | 'email:asc'
              | 'email:desc'
              | 'createdAt:asc'
              | 'createdAt:desc',
          },
        },
      });
      return throwIfError(result);
    },
  });

  const sortOptions = useMemo(
    () => [
      { value: 'createdAt:desc', label: '作成日 新しい順' },
      { value: 'createdAt:asc', label: '作成日 古い順' },
      { value: 'name:asc', label: '名前 昇順' },
      { value: 'name:desc', label: '名前 降順' },
      { value: 'email:asc', label: 'メール 昇順' },
      { value: 'email:desc', label: 'メール 降順' },
    ],
    [],
  );

  return {
    queryParams,
    setQueryParams,
    dialogOpen,
    setDialogOpen,
    selectedUser,
    setSelectedUser,
    data,
    isLoading,
    sortOptions,
  };
}

export function useMembershipDialog(user: AdminUser | null, open: boolean) {
  const queryClient = useQueryClient();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member'>('member');

  useEffect(() => {
    if (!open) {
      setSelectedOrganizationId('');
      setSelectedRole('member');
    }
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.userMemberships(user?.id ?? ''),
    queryFn: async () => {
      if (!user) {
        return null;
      }
      const result = await apiClient.GET('/api/admin/users/{userId}/memberships', {
        params: { path: { userId: user.id } },
      });
      return throwIfError(result);
    },
    enabled: open && !!user,
  });

  const invalidateTargets = async () => {
    if (!user) {
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.userMemberships(user.id) }),
      invalidateAdminUsersQueries(queryClient),
      queryClient.invalidateQueries({ queryKey: queryKeys.university.membersPrefix() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedOrganizationId) {
        return;
      }
      const result = await apiClient.POST('/api/admin/users/{userId}/memberships', {
        params: { path: { userId: user.id } },
        body: {
          organizationId: selectedOrganizationId,
          role: selectedRole,
        },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      toast.success('所属を追加しました');
      setSelectedOrganizationId('');
      setSelectedRole('member');
      await invalidateTargets();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? getApiErrorMessage(error, 'duplicate')
          : getApiErrorMessage(error);
      toast.error(message);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'owner' | 'member' }) => {
      const result = await apiClient.PUT('/api/admin/memberships/{memberId}/role', {
        params: { path: { memberId } },
        body: { role },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      toast.success('ロールを更新しました');
      await invalidateTargets();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? getApiErrorMessage(error, 'last-owner')
          : getApiErrorMessage(error);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await apiClient.DELETE('/api/admin/memberships/{memberId}', {
        params: { path: { memberId } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      toast.success('所属を解除しました');
      await invalidateTargets();
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? getApiErrorMessage(error, 'last-owner')
          : getApiErrorMessage(error);
      toast.error(message);
    },
  });

  return {
    memberships: (data?.data ?? []) as Membership[],
    isLoading,
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedRole,
    setSelectedRole,
    createMutation,
    changeRoleMutation,
    deleteMutation,
  };
}
