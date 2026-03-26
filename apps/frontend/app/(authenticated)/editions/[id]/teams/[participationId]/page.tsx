'use client';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { MarkdownContent } from '@/components/common/MarkdownContent';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import type { paths } from '@/lib/api/schema';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DownloadIcon, ExternalLinkIcon, LockIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { use, useState } from 'react';
import { toast } from 'sonner';

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

type ParticipationSubmissionListResponse =
  paths['/api/participations/{id}/submissions']['get']['responses'][200]['content']['application/json'];
type ParticipationSubmissionItem = ParticipationSubmissionListResponse['data'][number];
type CommentListResponse =
  paths['/api/participations/{id}/comments']['get']['responses'][200]['content']['application/json'];
type CommentItem = CommentListResponse['data'][number];

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string; participationId: string }>;
}) {
  const { participationId } = use(params);
  const { organizationId } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [subQueryParams, setSubQueryParams] = useQueryStates(paginationParsers);
  const [commentBody, setCommentBody] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  const { data: participation, isLoading: participationLoading } = useQuery({
    queryKey: queryKeys.participations.detail(participationId, organizationId ?? ''),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participations/{id}', {
        params: { path: { id: participationId } },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: queryKeys.participations.submissions(
      participationId,
      organizationId ?? '',
      subQueryParams,
    ),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participations/{id}/submissions', {
        params: {
          path: { id: participationId },
          query: { page: subQueryParams.page, pageSize: subQueryParams.pageSize },
        },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  const {
    data: comments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useQuery({
    queryKey: queryKeys.participations.comments(participationId, organizationId ?? '', {}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participations/{id}/comments', {
        params: { path: { id: participationId }, query: { pageSize: 100 } },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  const postCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      const result = await apiClient.POST('/api/participations/{id}/comments', {
        params: { path: { id: participationId } },
        body: { body },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
    onSuccess: () => {
      setCommentBody('');
      queryClient.invalidateQueries({
        queryKey: queryKeys.participations.comments(participationId, organizationId ?? '', {}),
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const result = await apiClient.PUT('/api/comments/{id}', {
        params: { path: { id } },
        body: { body },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
    onSuccess: () => {
      setEditingCommentId(null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.participations.comments(participationId, organizationId ?? '', {}),
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/comments/{id}', {
        params: { path: { id } },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      if (!result.response.ok) throw new ApiError(result.response.status, result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.participations.comments(participationId, organizationId ?? '', {}),
      });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleDownload = async (submissionId: string) => {
    const result = await apiClient.GET('/api/submissions/{id}/download', {
      params: { path: { id: submissionId } },
      headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
    });
    const data = throwIfError(result);
    window.open(data.data.presignedUrl, '_blank');
  };

  const submissionColumns: ColumnDef<ParticipationSubmissionItem>[] = [
    {
      header: 'テンプレート',
      cell: ({ row }) =>
        row.original.state === 'viewable'
          ? row.original.submission.template.name
          : row.original.template.name,
    },
    {
      header: '状態',
      cell: ({ row }) =>
        row.original.state === 'viewable' ? (
          `v${row.original.submission.version}`
        ) : (
          <span className='inline-flex items-center gap-1 text-muted-foreground'>
            <LockIcon className='h-3 w-3' />
            閲覧不可
          </span>
        ),
    },
    {
      header: 'ファイル / URL',
      cell: ({ row }) => {
        if (row.original.state === 'locked') {
          return (
            <span className='text-sm text-muted-foreground'>
              提出済み / この資料種別は自校未提出のため閲覧できません
            </span>
          );
        }

        const { id, template, fileName, url } = row.original.submission;
        if (template.acceptType === 'file') {
          return (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleDownload(id)}
              className='h-auto py-0 px-1'
            >
              <DownloadIcon className='h-3 w-3 mr-1' />
              {fileName ?? 'ダウンロード'}
            </Button>
          );
        }
        return url ? (
          <a
            href={url}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-primary hover:underline text-sm'
          >
            <ExternalLinkIcon className='h-3 w-3' />
            開く
          </a>
        ) : (
          '—'
        );
      },
    },
    {
      header: '更新日時',
      cell: ({ row }) => (
        <DateTimeDisplay
          value={String(
            row.original.state === 'viewable'
              ? row.original.submission.updatedAt
              : row.original.updatedAt,
          )}
        />
      ),
    },
  ];

  if (participationLoading) {
    return <Skeleton className='h-64 w-full' />;
  }

  const p = participation?.data;
  const canViewComments = !(commentsError instanceof ApiError && commentsError.status === 403);

  return (
    <div className='space-y-8'>
      {/* Team info */}
      <div>
        <h1 className='text-2xl font-bold'>{p?.teamName ?? '(チーム名なし)'}</h1>
        {p?.universityName && <p className='text-muted-foreground mt-1'>{p.universityName}</p>}
      </div>

      {/* Submissions */}
      <section className='space-y-4'>
        <h2 className='text-lg font-semibold'>提出資料</h2>
        <DataTable
          columns={submissionColumns}
          data={submissions?.data ?? []}
          isLoading={submissionsLoading}
          pagination={submissions?.pagination}
          onPageChange={(page) => setSubQueryParams({ page })}
          onPageSizeChange={(pageSize) => setSubQueryParams({ pageSize, page: 1 })}
        />
      </section>

      {/* Comments */}
      <section className='space-y-4'>
        <h2 className='text-lg font-semibold'>コメント</h2>

        {commentsLoading ? (
          <Skeleton className='h-32 w-full' />
        ) : !canViewComments ? (
          <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            この大学はまだ今大会で資料を提出していないため、他校コメントは閲覧できません。
          </div>
        ) : (
          <div className='space-y-4'>
            {(comments?.data ?? []).map((comment) => {
              const c = comment as CommentItem;
              const isOwn = user?.id === c.author?.id;
              const isEditing = editingCommentId === c.id;

              return (
                <div key={c.id} className='border rounded-lg p-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2 flex-wrap'>
                    <div className='text-sm'>
                      <span className='font-medium'>{c.author?.name}</span>
                      <span className='text-muted-foreground ml-2'>
                        {c.author?.universityName}
                        {c.author?.teamName && ` / ${c.author.teamName}`}
                      </span>
                    </div>
                    <div className='flex items-center gap-1'>
                      <DateTimeDisplay value={String(c.createdAt)} />
                      {isOwn && !isEditing && (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setEditingCommentId(c.id);
                            setEditingBody(c.body);
                          }}
                        >
                          <PencilIcon className='h-3 w-3' />
                        </Button>
                      )}
                      {(isOwn || user?.isAdmin) && (
                        <ConfirmDialog
                          trigger={
                            <Button
                              variant='ghost'
                              size='sm'
                              className='text-destructive hover:text-destructive'
                            >
                              <Trash2Icon className='h-3 w-3' />
                            </Button>
                          }
                          title='コメントを削除しますか？'
                          description='この操作は取り消せません。'
                          confirmLabel='削除'
                          onConfirm={() => deleteCommentMutation.mutate(c.id)}
                          destructive
                        />
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className='space-y-2'>
                      <Textarea
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        rows={3}
                        maxLength={5000}
                      />
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          onClick={() =>
                            updateCommentMutation.mutate({ id: c.id, body: editingBody })
                          }
                          disabled={updateCommentMutation.isPending}
                        >
                          更新
                        </Button>
                        <Button size='sm' variant='ghost' onClick={() => setEditingCommentId(null)}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <MarkdownContent content={c.body} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Comment form */}
        {canViewComments ? (
          <div className='space-y-2 border-t pt-4'>
            <Textarea
              placeholder='コメントを入力（Markdown対応、最大5000文字）'
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              maxLength={5000}
            />
            <div className='flex items-center justify-between'>
              <span className='text-xs text-muted-foreground'>{commentBody.length} / 5000</span>
              <Button
                size='sm'
                onClick={() => postCommentMutation.mutate(commentBody)}
                disabled={!commentBody.trim() || postCommentMutation.isPending}
              >
                コメントを投稿
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
