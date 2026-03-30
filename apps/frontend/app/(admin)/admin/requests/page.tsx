'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type ParticipationRequest,
  type UniversityRequest,
  useAdminRequestsPage,
} from '@/features/requests/hooks';
import { REQUEST_STATUS_LABELS } from '@/lib/utils/status';

function RequestStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{REQUEST_STATUS_LABELS[status] ?? status}</Badge>;
}

export default function AdminRequestsPage() {
  const {
    universityRequests,
    participationRequests,
    isLoading,
    approveUniversityMutation,
    rejectUniversityMutation,
    approveParticipationMutation,
    rejectParticipationMutation,
  } = useAdminRequestsPage();

  const universityColumns: ColumnDef<UniversityRequest>[] = [
    {
      header: '依頼内容',
      cell: ({ row }) => (
        <div className='space-y-1'>
          <div className='font-medium'>{row.original.universityName}</div>
          <div className='text-sm text-muted-foreground'>{row.original.representativeEmail}</div>
          <div className='text-sm'>{row.original.message}</div>
        </div>
      ),
    },
    {
      header: '申請者',
      cell: ({ row }) => (
        <div className='text-sm'>
          <div>{row.original.requestedBy.name}</div>
          <div className='text-muted-foreground'>{row.original.requestedBy.email}</div>
        </div>
      ),
    },
    {
      header: '状態',
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    },
    {
      header: '申請日時',
      cell: ({ row }) => <DateTimeDisplay value={row.original.createdAt} />,
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) =>
        row.original.status === 'pending' ? (
          <div className='flex gap-2'>
            <ConfirmDialog
              trigger={
                <button type='button' className='text-sm text-primary'>
                  承認
                </button>
              }
              title='大学追加依頼を承認しますか？'
              description={`${row.original.universityName} を作成し、${row.original.representativeEmail} に招待を送ります。`}
              confirmLabel='承認'
              onConfirm={() => approveUniversityMutation.mutate(row.original.id)}
            />
            <ConfirmDialog
              trigger={
                <button type='button' className='text-sm text-destructive'>
                  却下
                </button>
              }
              title='大学追加依頼を却下しますか？'
              description='この申請は却下済みとして保存されます。'
              confirmLabel='却下'
              onConfirm={() => rejectUniversityMutation.mutate(row.original.id)}
              destructive
            />
          </div>
        ) : (
          <span className='text-sm text-muted-foreground'>処理済み</span>
        ),
    },
  ];

  const participationColumns: ColumnDef<ParticipationRequest>[] = [
    {
      header: '対象',
      cell: ({ row }) => (
        <div className='space-y-1'>
          <div className='font-medium'>{`${row.original.edition.year}年 ${row.original.edition.name}`}</div>
          <div className='text-sm text-muted-foreground'>{row.original.university.name}</div>
          <div className='text-sm'>{row.original.teamName ?? '(チーム名なし)'}</div>
        </div>
      ),
    },
    {
      header: 'メッセージ',
      cell: ({ row }) => <div className='text-sm'>{row.original.message}</div>,
    },
    {
      header: '状態',
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    },
    {
      header: '申請者',
      cell: ({ row }) => (
        <div className='text-sm'>
          <div>{row.original.requestedBy.name}</div>
          <div className='text-muted-foreground'>{row.original.requestedBy.email}</div>
        </div>
      ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) =>
        row.original.status === 'pending' ? (
          <div className='flex gap-2'>
            <ConfirmDialog
              trigger={
                <Button type='button' className='text-sm text-primary'>
                  承認
                </Button>
              }
              title='出場追加依頼を承認しますか？'
              description='承認するとこの大会回の出場登録が作成されます。'
              confirmLabel='承認'
              onConfirm={() => approveParticipationMutation.mutate(row.original)}
            />
            <ConfirmDialog
              trigger={
                <Button type='button' className='text-sm text-destructive'>
                  却下
                </Button>
              }
              title='出場追加依頼を却下しますか？'
              description='この申請は却下済みとして保存されます。'
              confirmLabel='却下'
              onConfirm={() => rejectParticipationMutation.mutate(row.original.id)}
              destructive
            />
          </div>
        ) : (
          <span className='text-sm text-muted-foreground'>処理済み</span>
        ),
    },
  ];

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>申請管理</h1>
        <p className='text-sm text-muted-foreground mt-1'>
          大学追加依頼と出場追加依頼を審査します。
        </p>
      </div>

      <Tabs defaultValue='university' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='university'>大学追加依頼</TabsTrigger>
          <TabsTrigger value='participation'>出場追加依頼</TabsTrigger>
        </TabsList>

        <TabsContent value='university'>
          <DataTable
            columns={universityColumns}
            data={[...universityRequests].sort(
              (a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending'),
            )}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value='participation'>
          <DataTable
            columns={participationColumns}
            data={[...participationRequests].sort(
              (a, b) => Number(a.status !== 'pending') - Number(b.status !== 'pending'),
            )}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
