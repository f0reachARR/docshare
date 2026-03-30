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
import { type Member, useUniversitySettingsPage } from '@/features/university/settings/hooks';
import { ROLE_LABELS } from '@/lib/utils/status';
import type { ColumnDef } from '@tanstack/react-table';

export default function UniversitySettingsPage() {
  const {
    currentOrg,
    canEdit,
    data,
    isLoading,
    inviteForm,
    inviteMutation,
    changeRoleMutation,
    deleteMemberMutation,
    validators,
  } = useUniversitySettingsPage();

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
              <inviteForm.Field name='email' validators={{ onChange: validators.email }}>
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
                        {field.state.meta.errors[0].message}
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
