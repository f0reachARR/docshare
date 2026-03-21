'use client';

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
import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

type University = {
  id: string;
  name: string;
  slug: string;
  createdAt: unknown;
};

function CreateUniversityDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: { name: '', slug: '', ownerEmail: '' },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: { name: string; slug: string; ownerEmail: string }) => {
      const r = await apiClient.POST('/api/admin/universities', {
        body: {
          name: values.name,
          slug: values.slug,
          ownerEmail: values.ownerEmail || undefined,
        },
      });
      return throwIfError(r);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.universities({}) });
      toast.success('大学を作成しました');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>新規大学作成</DialogTitle>
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
                placeholder='○○大学'
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
        <form.Field
          name='slug'
          validators={{
            onChange: z
              .string()
              .min(1, 'スラッグを入力してください')
              .regex(/^[a-z0-9-]+$/, '半角英数字とハイフンのみ使用できます'),
          }}
        >
          {(field) => (
            <div className='space-y-1'>
              <label htmlFor={field.name} className='text-sm font-medium'>
                スラッグ *
              </label>
              <Input
                id={field.name}
                placeholder='example-university'
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
        <form.Field
          name='ownerEmail'
          validators={{
            onChange: z.string().email('有効なメールアドレスを入力してください').or(z.literal('')),
          }}
        >
          {(field) => (
            <div className='space-y-1'>
              <label htmlFor={field.name} className='text-sm font-medium'>
                オーナーメール（任意）
              </label>
              <Input
                id={field.name}
                type='email'
                placeholder='owner@example.ac.jp'
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
        <div className='flex justify-end gap-2'>
          <Button type='button' variant='ghost' onClick={onClose}>
            キャンセル
          </Button>
          <Button type='submit' disabled={mutation.isPending}>
            作成
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

export default function AdminUniversitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.universities({}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/universities', {
        params: { query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });

  const columns: ColumnDef<University>[] = [
    { header: '名称', accessorKey: 'name' },
    { header: 'スラッグ', accessorKey: 'slug' },
    {
      header: 'ID',
      accessorKey: 'id',
      cell: ({ row }) => (
        <span className='text-xs text-muted-foreground font-mono'>{row.original.id}</span>
      ),
    },
  ];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <h1 className='text-2xl font-bold'>大学管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size='sm'>
                <PlusIcon className='h-4 w-4 mr-1' />
                新規作成
              </Button>
            }
          />
          <CreateUniversityDialog onClose={() => setDialogOpen(false)} />
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={(data?.data ?? []) as University[]}
        isLoading={isLoading}
      />
    </div>
  );
}
