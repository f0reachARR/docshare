import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateUniversityMembersQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

export type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  createdAt: unknown;
};

export function useUniversitySettingsPage() {
  const { user } = useAuth();
  const { organizationId, currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const canEdit = currentOrg?.role === 'owner' || user?.isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.university.members(organizationId ?? '', {}),
    queryFn: async () => {
      if (!organizationId) {
        return null;
      }
      const result = await apiClient.GET('/api/university/members', {
        params: { header: { 'x-organization-id': organizationId } },
      });
      return throwIfError(result);
    },
    enabled: !!organizationId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (values: { email: string; role: 'owner' | 'member' }) => {
      const result = await apiClient.POST('/api/university/invite', {
        params: { header: { 'x-organization-id': organizationId ?? '' } },
        body: { email: values.email, role: values.role },
      });
      return throwIfError(result);
    },
    onSuccess: () => {
      toast.success('招待メールを送信しました');
      inviteForm.reset();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const inviteForm = useForm({
    defaultValues: { email: '', role: 'member' as 'owner' | 'member' },
    onSubmit: async ({ value }) => {
      await inviteMutation.mutateAsync(value);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const result = await apiClient.PUT('/api/university/members/{id}/role', {
        params: { path: { id: memberId }, header: { 'x-organization-id': organizationId ?? '' } },
        body: { role: role as 'owner' | 'member' },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await invalidateUniversityMembersQueries(queryClient, organizationId);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 409
          ? '最後のオーナーは変更できません'
          : getApiErrorMessage(err);
      toast.error(msg);
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const result = await apiClient.DELETE('/api/university/members/{id}', {
        params: { path: { id: memberId }, header: { 'x-organization-id': organizationId ?? '' } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      if (!organizationId) {
        return;
      }
      await invalidateUniversityMembersQueries(queryClient, organizationId);
      toast.success('メンバーを削除しました');
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError && err.status === 409
          ? '最後のオーナーは削除できません'
          : getApiErrorMessage(err);
      toast.error(msg);
    },
  });

  return {
    user,
    currentOrg,
    canEdit,
    data,
    isLoading,
    inviteForm,
    inviteMutation,
    changeRoleMutation,
    deleteMemberMutation,
    validators: {
      email: z.string().email('有効なメールアドレスを入力してください'),
    },
  };
}
