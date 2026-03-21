'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { ROLE_LABELS } from '@/lib/utils/status';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { z } from 'zod';

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
  createdAt: unknown;
};

export default function UniversitySettingsPage() {
  const { user } = useAuth();
  const { organizationId, currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const canEdit = currentOrg?.role === 'owner' || user?.isAdmin;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.university.members(organizationId ?? '', {}),
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.GET('/api/university/members', {
        params: { header: { 'x-organization-id': organizationId } },
      });
      return throwIfError(result);
    },
    enabled: !!organizationId,
  });

  const inviteForm = useForm({
    defaultValues: { email: '', role: 'member' as 'owner' | 'member' },
    onSubmit: async ({ value }) => {
      await inviteMutation.mutateAsync(value);
    },
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

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const result = await apiClient.PUT('/api/university/members/{id}/role', {
        params: { path: { id: memberId }, header: { 'x-organization-id': organizationId ?? '' } },
        body: { role: role as 'owner' | 'member' },
      });
      return throwIfError(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.university.members(organizationId ?? '', {}),
      });
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
      if (!result.response.ok) throw new ApiError(result.response.status, result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.university.members(organizationId ?? '', {}),
      });
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

  const columns: ColumnDef<Member>[] = [
    { header: '名前', accessorKey: 'name' },
    { header: 'メール', accessorKey: 'email' },
    {
      header: 'ロール',
      cell: ({ row }) =>
        canEdit ? (
          <Select
            value={row.original.role}
            onValueChange={(role) =>
              role && changeRoleMutation.mutate({ memberId: row.original.id, role })
            }
          >
            <SelectTrigger className='h-8 w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='owner'>オーナー</SelectItem>
              <SelectItem value='member'>メンバー</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant='secondary'>{ROLE_LABELS[row.original.role]}</Badge>
        ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) =>
        canEdit ? (
          <ConfirmDialog
            trigger={
              <Button size='sm' variant='ghost' className='text-destructive hover:text-destructive'>
                削除
              </Button>
            }
            title='メンバーを削除しますか？'
            description={`${row.original.name} を大学から削除します。`}
            confirmLabel='削除'
            onConfirm={() => deleteMemberMutation.mutate(row.original.id)}
            destructive
          />
        ) : null,
    },
  ];

  return (
    <div className='space-y-8 max-w-3xl'>
      <h1 className='text-2xl font-bold'>大学設定 — {currentOrg?.name}</h1>

      {/* Invite form */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>メンバーを招待</CardTitle>
            <CardDescription>メールアドレスに招待リンクを送信します</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteForm.handleSubmit();
              }}
              className='flex gap-3 flex-wrap'
            >
              <inviteForm.Field
                name='email'
                validators={{
                  onChange: z.string().email('有効なメールアドレスを入力してください'),
                }}
              >
                {(field) => (
                  <div className='flex-1 min-w-48 space-y-1'>
                    <Input
                      id={field.name}
                      type='email'
                      placeholder='you@example.com'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors[0] && (
                      <p className='text-sm text-destructive'>
                        {String(field.state.meta.errors[0])}
                      </p>
                    )}
                  </div>
                )}
              </inviteForm.Field>
              <inviteForm.Field name='role'>
                {(field) => (
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as 'owner' | 'member')}
                  >
                    <SelectTrigger className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='member'>メンバー</SelectItem>
                      <SelectItem value='owner'>オーナー</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </inviteForm.Field>
              <Button type='submit' disabled={inviteMutation.isPending}>
                招待する
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <section className='space-y-4'>
        <h2 className='text-lg font-semibold'>メンバー一覧</h2>
        <DataTable columns={columns} data={(data?.data ?? []) as Member[]} isLoading={isLoading} />
      </section>
    </div>
  );
}
