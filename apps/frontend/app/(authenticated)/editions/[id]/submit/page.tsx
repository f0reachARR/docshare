'use client';

import { ExternalLinkIcon, HistoryIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import Link from 'next/link';
import { use, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  type StatusItem,
  type TemplateItem,
  useSubmitPageData,
  useTemplateSubmissionMutations,
} from '@/features/editions/submit/hooks';
import { useParticipationRequestsSection } from '@/features/requests/hooks';
import { REQUEST_STATUS_LABELS } from '@/lib/utils/status';

export default function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    user,
    organizationId,
    selectedParticipationId,
    setSelectedParticipationId,
    isEditionLoading,
    isLoading,
    statusData,
    participations,
    templates,
    items,
    sharingStatus,
    edition,
    activeParticipationId,
    canDelete,
  } = useSubmitPageData(id);
  const {
    data: participationRequests,
    isLoading: isParticipationRequestsLoading,
    form: participationRequestForm,
    createMutation: createParticipationRequestMutation,
    validators: participationRequestValidators,
  } = useParticipationRequestsSection(id, organizationId);

  if (isLoading || isEditionLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-5 w-72' />
        <Skeleton className='h-64 w-full' />
      </div>
    );
  }

  if (!organizationId) {
    return <EmptyState title='大学コンテキストが必要です' />;
  }

  if (!statusData) {
    return <EmptyState title='この大会回は見つかりません' />;
  }

  if (sharingStatus === 'draft' && !user?.isAdmin) {
    return (
      <EmptyState title='この大会回は現在準備中です' description='受付開始後にアクセスできます。' />
    );
  }

  const isClosed = sharingStatus === 'closed';

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='space-y-1'>
          <h1 className='text-xl font-bold'>資料提出</h1>
          {edition ? (
            <p className='text-sm text-muted-foreground'>
              対象大会回:{' '}
              <span className='font-medium text-foreground'>{`${edition.year}年 ${edition.name}`}</span>
            </p>
          ) : null}
        </div>
        {sharingStatus && <StatusBadge status={sharingStatus} />}
      </div>

      {isClosed && (
        <div className='rounded-lg border border-muted bg-muted/50 px-4 py-3 text-sm text-muted-foreground'>
          この大会回は締め切られています。提出・変更はできません。
        </div>
      )}

      <Card>
        <CardHeader className='space-y-2'>
          <CardTitle className='text-base'>出場追加依頼</CardTitle>
          <p className='text-sm text-muted-foreground'>
            追加チームの出場登録が必要な場合は、ここから管理者に依頼できます。
          </p>
        </CardHeader>
        <CardContent className='space-y-6'>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              participationRequestForm.handleSubmit();
            }}
            className='space-y-4'
          >
            <participationRequestForm.Field name='teamName'>
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    チーム名義
                  </label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder='Team A'
                  />
                </div>
              )}
            </participationRequestForm.Field>
            <participationRequestForm.Field
              name='message'
              validators={{ onChange: participationRequestValidators.message }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    メッセージ
                  </label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors[0] && (
                    <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </participationRequestForm.Field>
            <div className='flex justify-end'>
              <Button
                type='submit'
                disabled={createParticipationRequestMutation.isPending || isClosed}
              >
                依頼を送信
              </Button>
            </div>
          </form>

          <div className='space-y-3'>
            <h2 className='text-sm font-medium'>この大会回の依頼状況</h2>
            {isParticipationRequestsLoading ? (
              <Skeleton className='h-24 w-full' />
            ) : participationRequests.length === 0 ? (
              <div className='rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground'>
                まだ依頼はありません。
              </div>
            ) : (
              participationRequests.map((request) => (
                <div key={request.id} className='rounded-lg border px-4 py-3 space-y-2'>
                  <div className='flex items-center justify-between gap-3 flex-wrap'>
                    <div className='font-medium'>{request.teamName ?? '(チーム名なし)'}</div>
                    <Badge
                      variant={
                        request.status === 'approved'
                          ? 'default'
                          : request.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                  </div>
                  <p className='text-sm'>{request.message}</p>
                  <p className='text-xs text-muted-foreground'>
                    申請日時: <DateTimeDisplay value={request.createdAt} />
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Team selection */}
      {participations.length > 1 ? (
        <div className='space-y-4'>
          <Card className='border-dashed'>
            <CardHeader className='space-y-2'>
              <CardTitle className='text-base'>提出先のチームを選択</CardTitle>
              <p className='text-sm text-muted-foreground'>
                複数の出場チームがあります。提出フォームを表示するには、先に提出先のチームを選んでください。
              </p>
            </CardHeader>
            <CardContent className='space-y-3'>
              {participations.map((p) => {
                const optionId = `participation-${p.id}`;
                const isSelected = selectedParticipationId === p.id;

                return (
                  <label
                    key={p.id}
                    htmlFor={optionId}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <input
                      id={optionId}
                      type='radio'
                      name='participation'
                      value={p.id}
                      checked={isSelected}
                      onChange={() => setSelectedParticipationId(p.id)}
                      className='mt-1 h-4 w-4 border-muted-foreground text-primary'
                    />
                    <div className='min-w-0'>
                      <div className='font-medium'>{p.teamName ?? '(チーム名なし)'}</div>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          {activeParticipationId ? (
            <TemplateList
              editionId={id}
              participationId={activeParticipationId}
              templates={templates}
              items={items.filter((i) => i.participationId === activeParticipationId)}
              isClosed={isClosed}
              canDelete={canDelete}
              organizationId={organizationId}
              onSuccess={() => {}}
            />
          ) : (
            <EmptyState
              title='チームを選ぶと提出フォームが表示されます'
              description='まず上のラジオボタンから提出先チームを選択してください。'
            />
          )}
        </div>
      ) : activeParticipationId ? (
        <TemplateList
          editionId={id}
          participationId={activeParticipationId}
          templates={templates}
          items={items.filter((i) => i.participationId === activeParticipationId)}
          isClosed={isClosed}
          canDelete={canDelete}
          organizationId={organizationId}
          onSuccess={() => {}}
        />
      ) : (
        <EmptyState title='この大会回への出場登録がありません' />
      )}
    </div>
  );
}

function TemplateList({
  editionId,
  participationId,
  templates,
  items,
  isClosed,
  canDelete,
  organizationId,
  onSuccess,
}: {
  editionId: string;
  participationId: string;
  templates: TemplateItem[];
  items: StatusItem[];
  isClosed: boolean;
  canDelete: boolean;
  organizationId: string;
  onSuccess: () => void;
}) {
  const sorted = [...templates].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className='space-y-4'>
      {sorted.map((template) => {
        const item = items.find((i) => i.templateId === template.id);
        return (
          <TemplateCard
            key={template.id}
            editionId={editionId}
            participationId={participationId}
            template={template}
            submission={item?.submission ?? null}
            isClosed={isClosed}
            canDelete={canDelete}
            organizationId={organizationId}
            onSuccess={onSuccess}
          />
        );
      })}
    </div>
  );
}

function TemplateCard({
  editionId,
  participationId,
  template,
  submission,
  isClosed,
  canDelete,
  organizationId,
  onSuccess,
}: {
  editionId: string;
  participationId: string;
  template: TemplateItem;
  submission: StatusItem['submission'] | null;
  isClosed: boolean;
  canDelete: boolean;
  organizationId: string;
  onSuccess: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [urlValue, setUrlValue] = useState(submission?.url ?? '');
  const { deleteMutation, uploadFileMutation, submitUrlMutation } = useTemplateSubmissionMutations({
    editionId,
    participationId,
    template,
    submission,
    organizationId,
    onSuccess,
    setUploadProgress,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileMutation.mutate(file);
    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-2 flex-wrap'>
          <div className='flex items-center gap-2 flex-wrap'>
            <CardTitle className='text-sm font-semibold'>{template.name}</CardTitle>
            {template.isRequired ? (
              <Badge variant='destructive' className='text-xs'>
                必須
              </Badge>
            ) : (
              <Badge variant='secondary' className='text-xs'>
                任意
              </Badge>
            )}
            <Badge variant='outline' className='text-xs'>
              {template.acceptType === 'file' ? 'ファイル' : 'URL'}
            </Badge>
          </div>
          {submission && (
            <Link
              href={`/editions/${editionId}/submissions/${submission.id}/history`}
              className='text-xs text-muted-foreground hover:text-foreground flex items-center gap-1'
            >
              <HistoryIcon className='h-3 w-3' />v{submission.version}
            </Link>
          )}
        </div>
        {template.description && (
          <p className='text-xs text-muted-foreground'>{template.description}</p>
        )}
        {template.acceptType === 'file' && (
          <p className='text-xs text-muted-foreground'>
            {template.allowedExtensions
              ? `拡張子: ${template.allowedExtensions.join(', ')} / `
              : ''}
            最大 {template.maxFileSizeMb}MB
          </p>
        )}
        {template.acceptType === 'url' && template.urlPattern && (
          <p className='text-xs text-muted-foreground'>対応ドメイン: {template.urlPattern}</p>
        )}
      </CardHeader>

      <CardContent className='space-y-3'>
        {/* Current submission status */}
        {submission ? (
          <div className='flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-2'>
            {submission.fileName ? (
              <span className='truncate text-xs'>{submission.fileName}</span>
            ) : submission.url ? (
              <a
                href={submission.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-1 text-primary hover:underline text-xs truncate'
              >
                <ExternalLinkIcon className='h-3 w-3 shrink-0' />
                {submission.url}
              </a>
            ) : null}
            <span className='text-muted-foreground text-xs ml-auto whitespace-nowrap'>
              <DateTimeDisplay value={String(submission.updatedAt)} />
            </span>
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>未提出</p>
        )}

        {/* Upload progress */}
        {uploadProgress !== null && <Progress value={uploadProgress} className='h-2' />}

        {/* Actions */}
        {!isClosed && (
          <div className='flex items-center gap-2 flex-wrap'>
            {template.acceptType === 'file' ? (
              <>
                <input
                  ref={fileInputRef}
                  type='file'
                  className='hidden'
                  accept={template.allowedExtensions?.map((e) => `.${e}`).join(',')}
                  onChange={handleFileChange}
                />
                <Button
                  size='sm'
                  variant={submission ? 'outline' : 'default'}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadFileMutation.isPending}
                >
                  <UploadIcon className='h-3 w-3 mr-1' />
                  {submission ? '差し替え' : 'アップロード'}
                </Button>
              </>
            ) : (
              <div className='flex items-center gap-2 flex-1'>
                <Input
                  type='url'
                  placeholder='https://'
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  className='h-8 text-sm'
                />
                <Button
                  size='sm'
                  onClick={() => submitUrlMutation.mutate(urlValue)}
                  disabled={!urlValue || submitUrlMutation.isPending}
                >
                  {submission ? '更新' : '登録'}
                </Button>
              </div>
            )}

            {submission && canDelete && (
              <ConfirmDialog
                trigger={
                  <Button
                    size='sm'
                    variant='ghost'
                    className='text-destructive hover:text-destructive'
                  >
                    <Trash2Icon className='h-3 w-3' />
                  </Button>
                }
                title='資料を削除しますか？'
                description='この操作は取り消せません。'
                confirmLabel='削除'
                onConfirm={() => deleteMutation.mutate()}
                destructive
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
