'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { s3Put } from '@/lib/utils/file';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';
import { z } from 'zod';

const SHARING_STATUS_LABELS: Record<Edition['sharingStatus'], string> = {
  draft: '準備中',
  accepting: '受付中',
  sharing: '共有中',
  closed: '締切後',
};

type Edition = {
  id: string;
  seriesId: string;
  year: number;
  name: string;
  description: string | null;
  ruleDocuments: { label: string; s3_key: string; mime_type: string; url: string }[] | null;
  sharingStatus: 'draft' | 'accepting' | 'sharing' | 'closed';
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

function EditionFormDialog({ editing, onClose }: { editing: Edition | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(editing?.externalLinks ?? []);

  const { data: seriesData } = useQuery({
    queryKey: ['series-all'],
    queryFn: async () => {
      const r = await apiClient.GET('/api/series', { params: { query: { pageSize: 100 } } });
      return throwIfError(r);
    },
  });

  const form = useForm({
    defaultValues: {
      seriesId: editing?.seriesId ?? '',
      year: editing?.year ?? new Date().getFullYear(),
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      sharingStatus: (editing?.sharingStatus ?? 'draft') as
        | 'draft'
        | 'accepting'
        | 'sharing'
        | 'closed',
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: {
      seriesId: string;
      year: number;
      name: string;
      description: string;
      sharingStatus: 'draft' | 'accepting' | 'sharing' | 'closed';
    }) => {
      const body = {
        seriesId: values.seriesId,
        year: values.year,
        name: values.name,
        description: values.description,
        sharingStatus: values.sharingStatus,
        externalLinks: externalLinks.length ? externalLinks : undefined,
      };
      if (editing) {
        const r = await apiClient.PUT('/api/admin/editions/{id}', {
          params: { path: { id: editing.id } },
          body,
        });
        return throwIfError(r);
      }
      const r = await apiClient.POST('/api/admin/editions', { body });
      return throwIfError(r);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editions'] });
      toast.success(editing ? '更新しました' : '作成しました');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const series = seriesData?.data ?? [];

  const updateLink = (i: number, field: keyof ExternalLink, value: string) => {
    setExternalLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const removeLink = (i: number) => {
    setExternalLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
      <DialogHeader>
        <DialogTitle>{editing ? '大会回を編集' : '新規大会回作成'}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className='space-y-4'
      >
        <form.Field
          name='seriesId'
          validators={{ onChange: z.string().min(1, 'シリーズを選択してください') }}
        >
          {(field) => (
            <div className='space-y-1'>
              <span className='text-sm font-medium'>シリーズ *</span>
              <Select value={field.state.value} onValueChange={(v) => field.handleChange(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder='選択...'>
                    {series.find((item) => item.id === field.state.value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {series.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors[0] && (
                <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
              )}
            </div>
          )}
        </form.Field>
        <div className='flex gap-3'>
          <form.Field name='year' validators={{ onChange: z.number().int().min(2000) }}>
            {(field) => (
              <div className='space-y-1 w-24'>
                <label htmlFor={field.name} className='text-sm font-medium'>
                  年度 *
                </label>
                <Input
                  id={field.name}
                  type='number'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                />
              </div>
            )}
          </form.Field>
          <form.Field
            name='name'
            validators={{ onChange: z.string().min(1, '名称を入力してください') }}
          >
            {(field) => (
              <div className='space-y-1 flex-1'>
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
        </div>
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
        <form.Field name='sharingStatus'>
          {(field) => (
            <div className='space-y-1'>
              <span className='text-sm font-medium'>共有状態</span>
              <Select
                value={field.state.value}
                onValueChange={(v) =>
                  field.handleChange(v as 'draft' | 'accepting' | 'sharing' | 'closed')
                }
              >
                <SelectTrigger>
                  <SelectValue>{SHARING_STATUS_LABELS[field.state.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='draft'>準備中</SelectItem>
                  <SelectItem value='accepting'>受付中</SelectItem>
                  <SelectItem value='sharing'>共有中</SelectItem>
                  <SelectItem value='closed'>締切後</SelectItem>
                </SelectContent>
              </Select>
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
            追加
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

export default function AdminEditionsPage() {
  const queryClient = useQueryClient();
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);
  const [editingItem, setEditingItem] = useState<Edition | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const ruleFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingEditionId, setUploadingEditionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.editions(queryParams),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions', {
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
      const result = await apiClient.DELETE('/api/admin/editions/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) throw new ApiError(result.response.status, result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editions'] });
      toast.success('削除しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const result = await apiClient.PUT('/api/admin/editions/{id}/status', {
        params: { path: { id } },
        body: { sharingStatus: status as 'draft' | 'accepting' | 'sharing' | 'closed' },
      });
      return throwIfError(result);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['editions'] }),
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleRuleUpload = async (editionId: string, file: File) => {
    try {
      const presignResult = await apiClient.POST('/api/admin/editions/{id}/rules/presign', {
        params: { path: { id: editionId } },
        body: { fileName: file.name, contentType: file.type },
      });
      const presign = throwIfError(presignResult);
      await s3Put(presign.data.presignedUrl, file);

      const edition = data?.data.find((e) => e.id === editionId);
      const existingDocs = (edition?.ruleDocuments ?? []).map((d) => ({
        label: d.label,
        s3_key: d.s3_key,
        mime_type: d.mime_type,
      }));

      await apiClient.PUT('/api/admin/editions/{id}/rules', {
        params: { path: { id: editionId } },
        body: {
          ruleDocuments: [
            ...existingDocs,
            { label: file.name, s3_key: presign.data.s3Key, mime_type: file.type },
          ],
        },
      });

      queryClient.invalidateQueries({ queryKey: ['editions'] });
      toast.success('ルール資料をアップロードしました');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
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
              status: status ?? row.original.sharingStatus,
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
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadingEditionId) handleRuleUpload(uploadingEditionId, file);
          e.target.value = '';
        }}
      />
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-bold'>大会回管理</h1>
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
