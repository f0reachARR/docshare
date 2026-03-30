'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditionFormDialog } from '@/features/admin/editions/EditionFormDialog';
import {
  useChangeEditionStatusMutation,
  useDeleteEditionMutation,
  useUploadEditionRuleMutation,
} from '@/features/admin/editions/mutations';
import { useAdminEditionsList } from '@/features/admin/editions/query';
import { SHARING_STATUS_LABELS } from '@/features/admin/editions/types';
import type { Edition, SharingStatus } from '@/features/admin/editions/types';
import type { ColumnDef } from '@tanstack/react-table';
import {
  LayoutListIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UploadIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useRef, useState } from 'react';

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
};

export default function AdminEditionsPage() {
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);
  const [editingItem, setEditingItem] = useState<Edition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const ruleFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingEditionId, setUploadingEditionId] = useState<string | null>(null);

  const { data, isLoading } = useAdminEditionsList(queryParams);
  const deleteMutation = useDeleteEditionMutation();
  const changeStatusMutation = useChangeEditionStatusMutation();
  const uploadRuleMutation = useUploadEditionRuleMutation();

  const handleRuleUpload = async (editionId: string, file: File) => {
    const edition = data?.data.find((item) => item.id === editionId);
    const existingDocs = (edition?.ruleDocuments ?? []).map((document) => ({
      label: document.label,
      s3_key: document.s3_key,
      mime_type: document.mime_type,
    }));

    try {
      await uploadRuleMutation.mutateAsync({ editionId, file, existingDocuments: existingDocs });
    } finally {
      setUploadingEditionId(null);
    }
  };

  const columns: ColumnDef<Edition>[] = [
    {
      header: '名称',
      cell: ({ row }) => `${row.original.year}年 ${row.original.name}`,
    },
    {
      header: '状態',
      cell: ({ row }) => (
        <Select
          value={row.original.sharingStatus}
          onValueChange={(status) =>
            changeStatusMutation.mutate({
              id: row.original.id,
              status: (status ?? row.original.sharingStatus) as SharingStatus,
            })
          }
        >
          <SelectTrigger className='h-8 w-28'>
            <SelectValue>{SHARING_STATUS_LABELS[row.original.sharingStatus]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='draft'>準備中</SelectItem>
            <SelectItem value='accepting'>受付中</SelectItem>
            <SelectItem value='sharing'>共有中</SelectItem>
            <SelectItem value='closed'>締切後</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className='flex gap-1 flex-wrap'>
          <Button
            variant='ghost'
            size='sm'
            render={<Link href={`/admin/editions/${row.original.id}/participations`} />}
          >
            <UsersIcon className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            render={<Link href={`/admin/editions/${row.original.id}/templates`} />}
          >
            <LayoutListIcon className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => {
              setUploadingEditionId(row.original.id);
              ruleFileInputRef.current?.click();
            }}
          >
            <UploadIcon className='h-3 w-3' />
          </Button>
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
            title='大会回を削除しますか？'
            description={`「${row.original.year}年 ${row.original.name}」を削除します。`}
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
      <input
        ref={ruleFileInputRef}
        type='file'
        className='hidden'
        accept='.pdf'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && uploadingEditionId) {
            void handleRuleUpload(uploadingEditionId, file);
          }
          event.target.value = '';
        }}
      />
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-bold'>大会回管理</h1>
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
              <EditionFormDialog
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
        data={(data?.data ?? []) as Edition[]}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams({ page })}
        onPageSizeChange={(pageSize) => setQueryParams({ pageSize, page: 1 })}
      />
    </div>
  );
}
