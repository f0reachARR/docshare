'use client';

import { UniversitySelect } from '@/components/admin/UniversitySelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type Participation,
  useAdminParticipationsPage,
} from '@/features/admin/participations/hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { use } from 'react';

export default function AdminParticipationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: editionId } = use(params);
  const {
    selectedUniversityId,
    setSelectedUniversityId,
    teamName,
    setTeamName,
    editingId,
    setEditingId,
    editingTeamName,
    setEditingTeamName,
    data,
    isLoading,
    createMutation,
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

      {/* Add participation */}
      <div className='flex gap-3 items-end flex-wrap'>
        <div className='space-y-1'>
          <span className='text-sm font-medium'>大学</span>
          <UniversitySelect
            value={selectedUniversityId}
            onValueChange={(id) => setSelectedUniversityId(id)}
          />
        </div>
        <div className='space-y-1'>
          <label htmlFor='team-name-input' className='text-sm font-medium'>
            チーム名（任意）
          </label>
          <Input
            id='team-name-input'
            placeholder='チーム名'
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className='w-40'
          />
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={!selectedUniversityId || createMutation.isPending}
        >
          <PlusIcon className='h-4 w-4 mr-1' />
          登録
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data ?? []) as Participation[]}
        isLoading={isLoading}
      />
    </div>
  );
}
