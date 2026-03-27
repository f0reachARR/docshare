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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TemplateFormDialog } from '@/features/admin/templates/TemplateFormDialog';
import {
  useCopyTemplatesMutation,
  useDeleteTemplateMutation,
} from '@/features/admin/templates/mutations';
import { useAdminTemplates, useEditionsForTemplateCopy } from '@/features/admin/templates/query';
import type { Template } from '@/features/admin/templates/types';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, CopyIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { use, useState } from 'react';

export default function AdminTemplatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: editionId } = use(params);
  const [editingItem, setEditingItem] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [sourceEditionId, setSourceEditionId] = useState('');
  const [comboOpen, setComboOpen] = useState(false);

  const { data, isLoading } = useAdminTemplates(editionId);
  const { data: editionsData } = useEditionsForTemplateCopy();
  const deleteMutation = useDeleteTemplateMutation(editionId);
  const copyMutation = useCopyTemplatesMutation(editionId, () => {
    setCopyDialogOpen(false);
  });

  const otherEditions = (editionsData?.data ?? []).filter((edition) => edition.id !== editionId);
  const selectedEdition = otherEditions.find((edition) => edition.id === sourceEditionId);

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
                        {otherEditions.map((edition) => (
                          <CommandItem
                            key={edition.id}
                            value={`${edition.year} ${edition.name}`}
                            onSelect={() => {
                              setSourceEditionId(edition.id);
                              setComboOpen(false);
                            }}
                          >
                            {sourceEditionId === edition.id && (
                              <CheckIcon className='h-3 w-3 mr-1' />
                            )}
                            {edition.year}年 {edition.name}
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
