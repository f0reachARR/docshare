import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@tanstack/react-form';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useUpsertSeriesMutation } from './mutations';
import type { ExternalLink, Series } from './types';

type Props = {
  editing: Series | null;
  onClose: () => void;
};

export function SeriesFormDialog({ editing, onClose }: Props) {
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(editing?.externalLinks ?? []);
  const mutation = useUpsertSeriesMutation(editing, externalLinks, onClose);

  const form = useForm({
    defaultValues: {
      name: editing?.name ?? '',
      description: editing?.description ?? '',
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const updateLink = (index: number, field: keyof ExternalLink, value: string) => {
    setExternalLinks((prev) =>
      prev.map((link, current) => (current === index ? { ...link, [field]: value } : link)),
    );
  };

  const removeLink = (index: number) => {
    setExternalLinks((prev) => prev.filter((_, current) => current !== index));
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? 'シリーズを編集' : '新規シリーズ作成'}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
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
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {field.state.meta.errors[0] && (
                <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
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
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>

        <div className='space-y-2'>
          <p className='text-sm font-medium'>外部リンク</p>
          {externalLinks.map((link, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dynamic list
            <div key={index} className='flex gap-2'>
              <Input
                placeholder='ラベル'
                value={link.label}
                onChange={(event) => updateLink(index, 'label', event.target.value)}
                className='w-24'
              />
              <Input
                placeholder='URL'
                value={link.url}
                onChange={(event) => updateLink(index, 'url', event.target.value)}
                className='flex-1'
              />
              <Button type='button' variant='ghost' size='sm' onClick={() => removeLink(index)}>
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
