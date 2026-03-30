import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@tanstack/react-form';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useUpsertEditionMutation } from './mutations';
import { useSeriesForEditionForm } from './query';
import type { Edition, ExternalLink, SharingStatus } from './types';
import { SHARING_STATUS_LABELS } from './types';

type Props = {
  editing: Edition | null;
  onClose: () => void;
};

export function EditionFormDialog({ editing, onClose }: Props) {
  const [externalLinks, setExternalLinks] = useState<ExternalLink[]>(editing?.externalLinks ?? []);
  const { data: seriesData } = useSeriesForEditionForm();
  const mutation = useUpsertEditionMutation(editing, externalLinks, onClose);

  const form = useForm({
    defaultValues: {
      seriesId: editing?.seriesId ?? '',
      year: editing?.year ?? new Date().getFullYear(),
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      sharingStatus: (editing?.sharingStatus ?? 'draft') as SharingStatus,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  const series = seriesData?.data ?? [];

  const updateLink = (index: number, field: keyof ExternalLink, value: string) => {
    setExternalLinks((prev) =>
      prev.map((link, current) => (current === index ? { ...link, [field]: value } : link)),
    );
  };

  const removeLink = (index: number) => {
    setExternalLinks((prev) => prev.filter((_, current) => current !== index));
  };

  return (
    <DialogContent className='max-w-lg max-h-[80vh] overflow-y-auto'>
      <DialogHeader>
        <DialogTitle>{editing ? '大会回を編集' : '新規大会回作成'}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
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
              <Select
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value ?? '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder='選択...'>
                    {series.find((item) => item.id === field.state.value)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {series.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors[0] && (
                <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
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
                  onChange={(event) => field.handleChange(Number(event.target.value))}
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
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                {field.state.meta.errors[0] && (
                  <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
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
                onChange={(event) => field.handleChange(event.target.value)}
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
                onValueChange={(value) => field.handleChange(value as SharingStatus)}
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
