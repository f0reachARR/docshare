'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

type Series = {
  id: string;
  name: string;
  description: string | null;
  externalLinks: { label: string; url: string }[] | null;
  createdAt: unknown;
  updatedAt: unknown;
};

type ExternalLink = { label: string; url: string };

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
};

function SeriesFormDialog({
  editing,
  onClose,
}: {
  editing: Series | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(editing?.externalLinks ?? []);

  const form = useForm({
    defaultValues: {
      name: editing?.name ?? '',
      description: editing?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: { name: string; description: string }) => {
      const body = {
        name: values.name,
        description: values.description,
        externalLinks: externalLinks.length ? externalLinks : undefined,
      };
      if (editing) {
        const r = await apiClient.PUT('/api/admin/series/{id}', {
          params: { path: { id: editing.id } },
          body,
        });
        return throwIfError(r);
      }
      const r = await apiClient.POST('/api/admin/series', { body });
      return throwIfError(r);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success(editing ? '更新しました' : '作成しました');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateLink = (i: number, field: keyof ExternalLink, value: string) => {
    setExternalLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const removeLink = (i: number) => {
    setExternalLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? 'シリーズを編集' : '新規シリーズ作成'}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className='space-y-4'
      >
        <form.Field
          name='name'
          validators={{ onChange: z.string().min(1, '名称を入力してください') }}
        >
          {(field) => (
            <div className='space-y-1'>
              <label htmlFor={field.name} className='text-sm font-medium'>
                名称 *
              </label>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors[0] && (
                <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='description'>
          {(field) => (
            <div className='space-y-1'>
              <label htmlFor={field.name} className='text-sm font-medium'>
                説明
              </label>
              <Textarea
                id={field.name}
                rows={2}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>
        <div className='space-y-2'>
          <p className='text-sm font-medium'>外部リンク</p>
          {externalLinks.map((link, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dynamic list
            <div key={i} className='flex gap-2'>
              <Input
                placeholder='ラベル'
                value={link.label}
                onChange={(e) => updateLink(i, 'label', e.target.value)}
                className='w-24'
              />
              <Input
                placeholder='URL'
                value={link.url}
                onChange={(e) => updateLink(i, 'url', e.target.value)}
                className='flex-1'
              />
              <Button type='button' variant='ghost' size='sm' onClick={() => removeLink(i)}>
                <Trash2Icon className='h-3 w-3' />
              </Button>
            </div>
          ))}
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setExternalLinks((prev) => [...prev, { label: '', url: '' }])}
          >
            <PlusIcon className='h-3 w-3 mr-1' />
            リンクを追加
          </Button>
        </div>
        <div className='flex justify-end gap-2'>
          <Button type='button' variant='ghost' onClick={onClose}>
            キャンセル
          </Button>
          <Button type='submit' disabled={mutation.isPending}>
            {editing ? '更新' : '作成'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export default function AdminSeriesPage() {
  const queryClient = useQueryClient();
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);
  const [editingItem, setEditingItem] = useState<Series | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.series(queryParams),
    queryFn: async () => {
      const result = await apiClient.GET('/api/series', {
        params: {
          query: {
            page: queryParams.page,
            pageSize: queryParams.pageSize,
            q: queryParams.q || undefined,
          },
        },
      });
      return throwIfError(result);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/admin/series/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) throw new ApiError(result.response.status, result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('削除しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

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
            onChange={(e) => setQueryParams({ q: e.target.value, page: 1 })}
            className='max-w-48'
          />
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditingItem(null);
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
