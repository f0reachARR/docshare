'use client';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { s3Put, validateFile } from '@/lib/utils/file';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLinkIcon, HistoryIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import Link from 'next/link';
import { use, useRef, useState } from 'react';
import { toast } from 'sonner';

export default function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { organizationId, currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedParticipationId, setSelectedParticipationId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.editions.mySubmissionStatus(id, organizationId ?? ''),
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.GET('/api/editions/{id}/my-submission-status', {
        params: { path: { id } },
        headers: { 'X-Organization-Id': organizationId },
      });
      return throwIfError(result);
    },
    enabled: !!organizationId,
  });

  const statusData = data?.data;
  const participations = statusData?.participations ?? [];
  const templates = statusData?.templates ?? [];
  const items = statusData?.items ?? [];
  const sharingStatus = statusData?.edition?.sharingStatus;

  const activeParticipationId =
    selectedParticipationId ?? (participations.length > 0 ? participations[0].id : null);

  const invalidateStatus = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.editions.mySubmissionStatus(id, organizationId ?? ''),
    });
  };

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
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
  const canDelete = !!(currentOrg?.role === 'owner' || user?.isAdmin);

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <h1 className='text-xl font-bold'>資料提出</h1>
        {sharingStatus && <StatusBadge status={sharingStatus} />}
      </div>

      {isClosed && (
        <div className='rounded-lg border border-muted bg-muted/50 px-4 py-3 text-sm text-muted-foreground'>
          この大会回は締め切られています。提出・変更はできません。
        </div>
      )}

      {/* Team tabs */}
      {participations.length > 1 ? (
        <Tabs value={activeParticipationId ?? ''} onValueChange={setSelectedParticipationId}>
          <TabsList>
            {participations.map((p) => (
              <TabsTrigger key={p.id} value={p.id}>
                {p.teamName ?? '(チーム名なし)'}
              </TabsTrigger>
            ))}
          </TabsList>
          {participations.map((p) => (
            <TabsContent key={p.id} value={p.id}>
              <TemplateList
                editionId={id}
                participationId={p.id}
                templates={templates}
                items={items.filter((i) => i.participationId === p.id)}
                isClosed={isClosed}
                canDelete={canDelete}
                organizationId={organizationId}
                onSuccess={invalidateStatus}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : activeParticipationId ? (
        <TemplateList
          editionId={id}
          participationId={activeParticipationId}
          templates={templates}
          items={items.filter((i) => i.participationId === activeParticipationId)}
          isClosed={isClosed}
          canDelete={canDelete}
          organizationId={organizationId}
          onSuccess={invalidateStatus}
        />
      ) : (
        <EmptyState title='この大会回への出場登録がありません' />
      )}
    </div>
  );
}

type TemplateItem = {
  id: string;
  name: string;
  description?: string | null;
  acceptType: 'file' | 'url';
  isRequired: boolean;
  allowedExtensions: string[] | null;
  urlPattern: string | null;
  maxFileSizeMb: number;
  sortOrder: number;
};

type StatusItem = {
  participationId: string;
  templateId: string;
  submission: {
    id: string;
    version: number;
    fileName: string | null;
    url: string | null;
    updatedAt?: unknown;
  } | null;
};

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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [urlValue, setUrlValue] = useState(submission?.url ?? '');

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!submission) return;
      const result = await apiClient.DELETE('/api/submissions/{id}', {
        params: { path: { id: submission.id } },
        headers: { 'X-Organization-Id': organizationId },
      });
      if (!result.response.ok) throw new ApiError(result.response.status, result.error);
    },
    onSuccess: () => {
      toast.success('資料を削除しました');
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'submission'));
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const validation = validateFile(file, template);
      if (!validation.ok) throw new Error(validation.message);

      // 1. Presign
      const presignResult = await apiClient.POST('/api/upload/presign', {
        body: {
          participationId,
          templateId: template.id,
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
        },
        headers: { 'X-Organization-Id': organizationId },
      });
      const presign = throwIfError(presignResult);

      // 2. S3 PUT
      setUploadProgress(0);
      await s3Put(presign.data.presignedUrl, file, setUploadProgress);

      // 3. Submit
      const body = {
        s3Key: presign.data.s3Key,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      };

      if (submission) {
        const r = await apiClient.PUT('/api/submissions/{id}', {
          params: { path: { id: submission.id } },
          body,
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(r);
      } else {
        const r = await apiClient.POST('/api/submissions', {
          body: { ...body, templateId: template.id, participationId },
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(r);
      }
    },
    onSuccess: () => {
      setUploadProgress(null);
      toast.success('資料をアップロードしました');
      onSuccess();
    },
    onError: (err) => {
      setUploadProgress(null);
      toast.error(err instanceof Error ? err.message : getApiErrorMessage(err, 'submission'));
    },
  });

  const submitUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (submission) {
        const r = await apiClient.PUT('/api/submissions/{id}', {
          params: { path: { id: submission.id } },
          body: { url },
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(r);
      } else {
        const r = await apiClient.POST('/api/submissions', {
          body: { url, templateId: template.id, participationId },
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(r);
      }
    },
    onSuccess: () => {
      toast.success('URLを登録しました');
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'submission'));
    },
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
                <ExternalLinkIcon className='h-3 w-3 flex-shrink-0' />
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
