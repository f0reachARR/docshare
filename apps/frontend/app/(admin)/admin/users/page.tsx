'use client';

import { type UniversityOption, UniversitySelect } from '@/components/admin/UniversitySelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { ROLE_LABELS } from '@/lib/utils/status';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: unknown;
  organizationCount: number;
};

type Membership = {
  memberId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: 'owner' | 'member';
  createdAt: unknown;
};

const listParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
  sort: parseAsString.withDefault('createdAt:desc'),
};

function MembershipDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
      queryClient.invalidateQueries({ queryKey: ['university', 'members'] }),
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

  const memberships = (data?.data ?? []) as Membership[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>所属管理: {user?.name ?? ''}</DialogTitle>
        </DialogHeader>

        <div className='space-y-3 rounded-md border p-3'>
          <p className='text-sm font-medium'>大学へ所属させる</p>
          <div className='flex flex-wrap gap-2'>
            <UniversitySelect
              value={selectedOrganizationId}
              onValueChange={(id: string, university: UniversityOption | null) => {
                setSelectedOrganizationId(university?.id ?? id);
              }}
              placeholder='大学を選択'
              disabled={createMutation.isPending}
            />
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as 'owner' | 'member')}
            >
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='member'>メンバー</SelectItem>
                <SelectItem value='owner'>オーナー</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!selectedOrganizationId || createMutation.isPending}
            >
              所属追加
            </Button>
          </div>
        </div>

        <div className='space-y-2'>
          <p className='text-sm font-medium'>現在の所属</p>
          {isLoading ? (
            <p className='text-sm text-muted-foreground'>読み込み中...</p>
          ) : memberships.length === 0 ? (
            <p className='text-sm text-muted-foreground'>所属がありません</p>
          ) : (
            <div className='space-y-2'>
              {memberships.map((membership) => (
                <div
                  key={membership.memberId}
                  className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'
                >
                  <div>
                    <p className='font-medium'>{membership.organizationName}</p>
                    <p className='text-xs text-muted-foreground'>
                      slug: {membership.organizationSlug}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Select
                      value={membership.role}
                      onValueChange={(value) =>
                        changeRoleMutation.mutate({
                          memberId: membership.memberId,
                          role: value as 'owner' | 'member',
                        })
                      }
                    >
                      <SelectTrigger className='w-32'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='owner'>オーナー</SelectItem>
                        <SelectItem value='member'>メンバー</SelectItem>
                      </SelectContent>
                    </Select>
                    <ConfirmDialog
                      trigger={
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-destructive hover:text-destructive'
                        >
                          解除
                        </Button>
                      }
                      title='所属を解除しますか？'
                      description={`${membership.organizationName} から解除します。`}
                      confirmLabel='解除'
                      onConfirm={() => deleteMutation.mutate(membership.memberId)}
                      destructive
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsersPage() {
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

  const columns: ColumnDef<AdminUser>[] = [
    {
      header: 'ユーザー',
      cell: ({ row }) => (
        <div>
          <p className='font-medium'>{row.original.name}</p>
          <p className='text-xs text-muted-foreground'>{row.original.email}</p>
        </div>
      ),
    },
    {
      header: '権限',
      cell: ({ row }) =>
        row.original.isAdmin ? <Badge>Admin</Badge> : <Badge variant='secondary'>User</Badge>,
    },
    {
      header: '所属数',
      cell: ({ row }) => <span>{row.original.organizationCount}</span>,
    },
    {
      header: '作成日',
      cell: ({ row }) => <DateTimeDisplay value={String(row.original.createdAt)} dateOnly />,
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => {
            setSelectedUser(row.original);
            setDialogOpen(true);
          }}
        >
          所属管理
        </Button>
      ),
    },
  ];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-bold'>ユーザー管理</h1>
        <div className='flex gap-2 flex-wrap'>
          <Input
            placeholder='名前・メールで検索...'
            defaultValue={queryParams.q}
            onChange={(e) => setQueryParams({ q: e.target.value, page: 1 })}
            className='max-w-56'
          />
          <Select
            value={queryParams.sort}
            onValueChange={(value) => setQueryParams({ sort: value })}
          >
            <SelectTrigger className='w-48'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data ?? []) as AdminUser[]}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams({ page })}
        onPageSizeChange={(pageSize) => setQueryParams({ pageSize, page: 1 })}
      />

      <MembershipDialog user={selectedUser} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
