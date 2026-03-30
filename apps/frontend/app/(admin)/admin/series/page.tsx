'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SeriesFormDialog } from '@/features/admin/series/SeriesFormDialog';
import { useDeleteSeriesMutation } from '@/features/admin/series/mutations';
import { useAdminSeriesList } from '@/features/admin/series/query';
import type { Series } from '@/features/admin/series/types';
import type { ColumnDef } from '@tanstack/react-table';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
};

export default function AdminSeriesPage() {
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);
  const [editingItem, setEditingItem] = useState<Series | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useAdminSeriesList(queryParams);
  const deleteMutation = useDeleteSeriesMutation();

  const columns: ColumnDef<Series>[] = [
    { header: '名称', accessorKey: 'name' },
    { header: '説明', cell: ({ row }) => row.original.description?.slice(0, 40) ?? '—' },
    {
      header: '作成日',
      cell: ({ row }) => <DateTimeDisplay value={String(row.original.createdAt)} dateOnly />,
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
              setEditingItem(row.original);
              setDialogOpen(true);
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
            title='シリーズを削除しますか？'
            description={`「${row.original.name}」を削除します。この操作は取り消せません。`}
            confirmLabel='削除'
            onConfirm={() => deleteMutation.mutate(row.original.id)}
            destructive
          />
        </div>
      ),
    },
  ];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-bold'>大会シリーズ管理</h1>
        <div className='flex gap-2'>
          <Input
            placeholder='検索...'
            defaultValue={queryParams.q}
            onChange={(event) => setQueryParams({ q: event.target.value, page: 1 })}
            className='max-w-48'
          />
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingItem(null);
              }
            }}
          >
            <DialogTrigger
              render={
                <Button size='sm' onClick={() => setEditingItem(null)}>
                  <PlusIcon className='h-4 w-4 mr-1' />
                  新規作成
                </Button>
              }
            />
            {dialogOpen ? (
              <SeriesFormDialog
                key={editingItem?.id ?? 'new'}
                editing={editingItem}
                onClose={() => {
                  setDialogOpen(false);
                  setEditingItem(null);
                }}
              />
            ) : null}
          </Dialog>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={(data?.data ?? []) as Series[]}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams({ page })}
        onPageSizeChange={(pageSize) => setQueryParams({ pageSize, page: 1 })}
      />
    </div>
  );
}
