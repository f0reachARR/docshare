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
import {
  type University,
  useAdminUniversitiesList,
  useCreateUniversityForm,
} from '@/features/admin/universities/hooks';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

function CreateUniversityDialog({ onClose }: { onClose: () => void }) {
  const { form, mutation, validators } = useCreateUniversityForm(onClose);

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
        <form.Field name='name' validators={{ onChange: validators.name }}>
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
                <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='slug' validators={{ onChange: validators.slug }}>
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
                <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='ownerEmail' validators={{ onChange: validators.ownerEmail }}>
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
                <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
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
  const { data, isLoading } = useAdminUniversitiesList();

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
