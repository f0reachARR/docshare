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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useUpsertTemplateMutation } from './mutations';
import type { Template, TemplateAcceptType } from './types';

const ACCEPT_TYPE_LABELS: Record<TemplateAcceptType, string> = {
  file: 'ファイル',
  url: 'URL',
};

type Props = {
  editionId: string;
  editing: Template | null;
  onClose: () => void;
};

export function TemplateFormDialog({ editionId, editing, onClose }: Props) {
  const mutation = useUpsertTemplateMutation(editionId, editing, onClose);

  const form = useForm({
    defaultValues: {
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      acceptType: (editing?.acceptType ?? 'file') as TemplateAcceptType,
      allowedExtensions: editing?.allowedExtensions?.join(', ') ?? '',
      urlPattern: editing?.urlPattern ?? '',
      maxFileSizeMb: editing?.maxFileSizeMb ?? 100,
      isRequired: editing?.isRequired ?? false,
      sortOrder: editing?.sortOrder ?? 0,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? 'テンプレートを編集' : '新規テンプレート作成'}</DialogTitle>
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

        <form.Field name='acceptType'>
          {(field) => (
            <div className='space-y-1'>
              <span className='text-sm font-medium'>種別</span>
              <Select
                value={field.state.value}
                onValueChange={(value) =>
                  field.handleChange((value ?? 'file') as TemplateAcceptType)
                }
              >
                <SelectTrigger>
                  <SelectValue>{ACCEPT_TYPE_LABELS[field.state.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='file'>ファイル</SelectItem>
                  <SelectItem value='url'>URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.acceptType}>
          {(acceptType) => (
            <>
              {acceptType === 'file' && (
                <>
                  <form.Field name='allowedExtensions'>
                    {(field) => (
                      <div className='space-y-1'>
                        <label htmlFor={field.name} className='text-sm font-medium'>
                          許可拡張子（カンマ区切り）
                        </label>
                        <Input
                          id={field.name}
                          placeholder='pdf, docx'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                        />
                      </div>
                    )}
                  </form.Field>

                  <form.Field name='maxFileSizeMb'>
                    {(field) => (
                      <div className='space-y-1'>
                        <label htmlFor={field.name} className='text-sm font-medium'>
                          最大ファイルサイズ (MB)
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
                </>
              )}

              {acceptType === 'url' && (
                <form.Field name='urlPattern'>
                  {(field) => (
                    <div className='space-y-1'>
                      <label htmlFor={field.name} className='text-sm font-medium'>
                        URLパターン（ヒント用）
                      </label>
                      <Input
                        id={field.name}
                        placeholder='github.com'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                    </div>
                  )}
                </form.Field>
              )}
            </>
          )}
        </form.Subscribe>

        <div className='flex gap-4'>
          <form.Field name='isRequired'>
            {(field) => (
              <div className='flex items-center gap-2'>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <span className='text-sm font-medium'>必須</span>
              </div>
            )}
          </form.Field>
          <form.Field name='sortOrder'>
            {(field) => (
              <div className='flex items-center gap-2'>
                <label htmlFor={field.name} className='text-sm font-medium'>
                  順序
                </label>
                <Input
                  id={field.name}
                  type='number'
                  className='w-16 h-8'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(Number(event.target.value))}
                />
              </div>
            )}
          </form.Field>
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
