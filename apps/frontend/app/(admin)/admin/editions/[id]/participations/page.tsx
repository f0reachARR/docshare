'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { use } from 'react';
import { UniversityMultiSelect } from '@/components/admin/UniversityMultiSelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type Participation,
  useAdminParticipationsPage,
} from '@/features/admin/participations/hooks';

export default function AdminParticipationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: editionId } = use(params);
  const {
    draftRows,
    addDraftRows,
    updateDraftTeamName,
    removeDraftRow,
    editingId,
    setEditingId,
    editingTeamName,
    setEditingTeamName,
    data,
    isLoading,
    createManyMutation,
    updateMutation,
    deleteMutation,
  } = useAdminParticipationsPage(editionId);
  const columns: ColumnDef<Participation>[] = [
    { header: '大学名', accessorKey: 'universityName' },
    {
      header: 'チーム名',
      cell: ({ row }) =>
        editingId === row.original.id ? (
          <div className='flex gap-1'>
            <Input
              value={editingTeamName}
              onChange={(e) => setEditingTeamName(e.target.value)}
              className='h-7 w-36'
            />
            <Button
              variant='ghost'
              size='sm'
              onClick={() =>
                updateMutation.mutate({ id: row.original.id, teamName: editingTeamName })
              }
            >
              <CheckIcon className='h-3 w-3' />
            </Button>
          </div>
        ) : (
          <span>{row.original.teamName ?? '—'}</span>
        ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className='flex gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setEditingId(row.original.id);
              setEditingTeamName(row.original.teamName ?? '');
            }}
          >
            <PencilIcon className='h-3 w-3' />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant='ghost' size='sm' className='text-destructive hover:text-destructive'>
                <Trash2Icon className='h-3 w-3' />
              </Button>
            }
            title='出場登録を削除しますか？'
            description={`${row.original.universityName} の登録を削除します。`}
            confirmLabel='削除'
            onConfirm={() => deleteMutation.mutate(row.original.id)}
            destructive
          />
        </div>
      ),
    },
  ];

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-bold'>出場登録管理</h1>

      <section className='space-y-3'>
        <div className='flex flex-wrap items-end gap-3'>
          <div className='space-y-1'>
            <span className='text-sm font-medium'>大学</span>
            <UniversityMultiSelect onAdd={addDraftRows} disabled={createManyMutation.isPending} />
          </div>
          <Button
            onClick={() => createManyMutation.mutate()}
            disabled={draftRows.length === 0 || createManyMutation.isPending}
          >
            登録
          </Button>
        </div>

        <div className='overflow-hidden rounded-lg border'>
          {draftRows.length === 0 ? (
            <div className='px-4 py-6 text-sm text-muted-foreground'>
              登録する大学を選択してください
            </div>
          ) : (
            <div className='divide-y'>
              <div className='hidden grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_2.5rem] gap-3 bg-muted/40 px-3 py-2 text-sm font-medium sm:grid'>
                <span>大学名</span>
                <span>チーム名（任意）</span>
                <span className='sr-only'>操作</span>
              </div>
              {draftRows.map((row) => (
                <div
                  key={row.id}
                  className='grid grid-cols-1 items-center gap-3 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_2.5rem]'
                >
                  <div className='min-w-0 truncate text-sm font-medium'>{row.universityName}</div>
                  <Input
                    placeholder='チーム名'
                    value={row.teamName}
                    onChange={(e) => updateDraftTeamName(row.id, e.target.value)}
                    disabled={createManyMutation.isPending}
                  />
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    className='text-destructive hover:text-destructive'
                    onClick={() => removeDraftRow(row.id)}
                    disabled={createManyMutation.isPending}
                    aria-label={`${row.universityName} を候補から削除`}
                  >
                    <Trash2Icon className='h-4 w-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <DataTable
        columns={columns}
        data={(data?.data ?? []) as Participation[]}
        isLoading={isLoading}
      />
    </div>
  );
}
