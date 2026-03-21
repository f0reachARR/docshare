'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

const ACCEPT_TYPE_LABELS: Record<Template['acceptType'], string> = {
  file: 'ファイル',
  url: 'URL',
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  acceptType: 'file' | 'url';
  allowedExtensions: string[] | null;
  urlPattern: string | null;
  maxFileSizeMb: number;
  isRequired: boolean;
  sortOrder: number;
  createdAt: unknown;
};

function TemplateFormDialog({
  editionId,
  editing,
  onClose,
}: {
  editionId: string;
  editing: Template | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      acceptType: (editing?.acceptType ?? 'file') as 'file' | 'url',
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

  const mutation = useMutation({
    mutationFn: async (values: {
      name: string;
      description: string;
      acceptType: 'file' | 'url';
      allowedExtensions: string;
      urlPattern: string;
      maxFileSizeMb: number;
      isRequired: boolean;
      sortOrder: number;
    }) => {
      const body = {
        name: values.name,
        description: values.description,
        acceptType: values.acceptType,
        allowedExtensions:
          values.acceptType === 'file' && values.allowedExtensions
            ? values.allowedExtensions
                .split(',')
                .map((e) => e.trim())
                .filter(Boolean)
            : undefined,
        urlPattern: values.acceptType === 'url' ? values.urlPattern : undefined,
        maxFileSizeMb: values.maxFileSizeMb,
        isRequired: values.isRequired,
        sortOrder: values.sortOrder,
      };
      if (editing) {
        const r = await apiClient.PUT('/api/admin/templates/{id}', {
          params: { path: { id: editing.id } },
          body,
        });
        return throwIfError(r);
      }
      const r = await apiClient.POST('/api/admin/editions/{id}/templates', {
        params: { path: { id: editionId } },
        body,
      });
      return throwIfError(r);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates(editionId, {}) });
      toast.success(editing ? '更新しました' : '作成しました');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? 'テンプレートを編集' : '新規テンプレート作成'}</DialogTitle>
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
        <form.Field name='acceptType'>
          {(field) => (
            <div className='space-y-1'>
              <span className='text-sm font-medium'>種別</span>
              <Select
                value={field.state.value}
                onValueChange={(v) => field.handleChange((v ?? 'file') as 'file' | 'url')}
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
                          onChange={(e) => field.handleChange(e.target.value)}
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
                          onChange={(e) => field.handleChange(Number(e.target.value))}
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
                        onChange={(e) => field.handleChange(e.target.value)}
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
                  onChange={(e) => field.handleChange(Number(e.target.value))}
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

export default function AdminTemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: editionId } = use(params);
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [sourceEditionId, setSourceEditionId] = useState('');
  const [comboOpen, setComboOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.templates(editionId, {}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions/{id}/templates', {
        params: { path: { id: editionId }, query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });

  const { data: editionsData } = useQuery({
    queryKey: ['editions-all-for-copy'],
    queryFn: async () => {
      const r = await apiClient.GET('/api/editions', { params: { query: { pageSize: 100 } } });
      return throwIfError(r);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/admin/templates/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) throw new ApiError(result.response.status, result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates(editionId, {}) });
      toast.success('削除しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const copyMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const result = await apiClient.POST(
        '/api/admin/editions/{id}/templates/copy-from/{sourceEditionId}',
        {
          params: { path: { id: editionId, sourceEditionId: sourceId } },
        },
      );
      return throwIfError(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.templates(editionId, {}) });
      toast.success('テンプレートをコピーしました');
      setCopyDialogOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const otherEditions = (editionsData?.data ?? []).filter((e) => e.id !== editionId);
  const selectedEdition = otherEditions.find((e) => e.id === sourceEditionId);

  const columns: ColumnDef<Template>[] = [
    { header: '順序', cell: ({ row }) => row.original.sortOrder },
    { header: '名称', accessorKey: 'name' },
    {
      header: '種別',
      cell: ({ row }) => (
        <Badge variant='outline'>{row.original.acceptType === 'file' ? 'ファイル' : 'URL'}</Badge>
      ),
    },
    {
      header: '必須',
      cell: ({ row }) =>
        row.original.isRequired ? (
          <Badge variant='destructive'>必須</Badge>
        ) : (
          <Badge variant='secondary'>任意</Badge>
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
            title='テンプレートを削除しますか？'
            description={`「${row.original.name}」を削除します。`}
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
        <h1 className='text-2xl font-bold'>テンプレート管理</h1>
        <div className='flex gap-2'>
          <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
            <DialogTrigger
              render={
                <Button variant='outline' size='sm'>
                  <CopyIcon className='h-4 w-4 mr-1' />
                  他回からコピー
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>他の大会回からテンプレートをコピー</DialogTitle>
              </DialogHeader>
              <div className='space-y-4 py-2'>
                <Popover open={comboOpen} onOpenChange={setComboOpen}>
                  <PopoverTrigger
                    render={<Button variant='outline' className='w-full justify-start' />}
                  >
                    {selectedEdition
                      ? `${selectedEdition.year}年 ${selectedEdition.name}`
                      : 'コピー元の大会回を選択...'}
                  </PopoverTrigger>
                  <PopoverContent className='w-64 p-0'>
                    <Command>
                      <CommandInput placeholder='検索...' />
                      <CommandEmpty>見つかりません</CommandEmpty>
                      <CommandGroup>
                        {otherEditions.map((e) => (
                          <CommandItem
                            key={e.id}
                            value={`${e.year} ${e.name}`}
                            onSelect={() => {
                              setSourceEditionId(e.id);
                              setComboOpen(false);
                            }}
                          >
                            {sourceEditionId === e.id && <CheckIcon className='h-3 w-3 mr-1' />}
                            {e.year}年 {e.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className='flex justify-end gap-2'>
                  <Button variant='ghost' onClick={() => setCopyDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button
                    onClick={() => copyMutation.mutate(sourceEditionId)}
                    disabled={!sourceEditionId || copyMutation.isPending}
                  >
                    コピー
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
              <TemplateFormDialog
                key={editingItem?.id ?? 'new'}
                editionId={editionId}
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
      <DataTable columns={columns} data={(data?.data ?? []) as Template[]} isLoading={isLoading} />
    </div>
  );
}
