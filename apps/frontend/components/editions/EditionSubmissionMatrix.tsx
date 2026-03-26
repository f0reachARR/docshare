'use client';

import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import type { paths } from '@/lib/api/schema';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import { Download, ExternalLink, LockIcon } from 'lucide-react';
import Link from 'next/link';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import { useState } from 'react';

type SubmissionMatrixData =
  paths['/api/editions/{id}/submission-matrix']['get']['responses'][200]['content']['application/json'];
type SubmissionCell = SubmissionMatrixData['rows'][number]['cells'][number];

const matrixSortValues = [
  'createdAt:asc',
  'createdAt:desc',
  'teamName:asc',
  'teamName:desc',
  'universityName:asc',
  'universityName:desc',
] as const;

const matrixSortLabelMap: Record<(typeof matrixSortValues)[number], string> = {
  'createdAt:asc': '作成順 (古い順)',
  'createdAt:desc': '作成順 (新しい順)',
  'teamName:asc': 'チーム名 (昇順)',
  'teamName:desc': 'チーム名 (降順)',
  'universityName:asc': '大学名 (昇順)',
  'universityName:desc': '大学名 (降順)',
};

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
  sort: parseAsStringEnum([...matrixSortValues]).withDefault('createdAt:asc'),
};

export function EditionSubmissionMatrix({ editionId }: { editionId: string }) {
  const { organizationId } = useOrganization();
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);
  const [downloadingSubmissionId, setDownloadingSubmissionId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.editions.submissionMatrix(editionId, organizationId ?? '', queryParams),
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('大学コンテキストが必要です');
      }

      const result = await apiClient.GET('/api/editions/{id}/submission-matrix', {
        params: {
          path: { id: editionId },
          query: {
            page: queryParams.page,
            pageSize: queryParams.pageSize,
            q: queryParams.q || undefined,
            sort: queryParams.sort as (typeof matrixSortValues)[number],
          },
        },
        headers: { 'X-Organization-Id': organizationId },
      });
      return throwIfError(result);
    },
    enabled: !!organizationId,
  });

  const matrix = data as SubmissionMatrixData | undefined;

  const handleDownload = async (submissionId: string) => {
    if (!organizationId) {
      return;
    }

    setDownloadingSubmissionId(submissionId);
    try {
      const result = await apiClient.GET('/api/submissions/{id}/download', {
        params: {
          path: { id: submissionId },
        },
        headers: { 'X-Organization-Id': organizationId },
      });
      const response = throwIfError(result);
      window.open(response.data.presignedUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingSubmissionId(null);
    }
  };

  const renderCell = (cell: SubmissionCell) => {
    if (cell.state === 'empty') {
      return <span className='text-muted-foreground'>—</span>;
    }

    if (cell.state === 'locked') {
      return (
        <div className='space-y-1'>
          <p className='inline-flex items-center gap-1 text-xs font-medium text-muted-foreground'>
            <LockIcon className='h-3.5 w-3.5' />
            提出済み
          </p>
          <p className='text-[11px] text-muted-foreground'>
            この資料種別は自校未提出のため閲覧できません
          </p>
        </div>
      );
    }

    const submission = cell.submission;

    return (
      <div className='space-y-1'>
        {submission.fileName ? (
          <p className='text-xs font-medium break-all'>{submission.fileName}</p>
        ) : null}
        <div className='flex items-center gap-2 flex-wrap'>
          {submission.url ? (
            <a
              href={submission.url}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-1 text-primary hover:underline text-xs'
            >
              <ExternalLink className='h-3.5 w-3.5' />
              閲覧
            </a>
          ) : null}
          {submission.fileName ? (
            <Button
              variant='outline'
              size='xs'
              disabled={downloadingSubmissionId === submission.id}
              onClick={() => handleDownload(submission.id)}
            >
              <Download className='h-3.5 w-3.5' />
              ダウンロード
            </Button>
          ) : null}
        </div>
        <p className='text-[11px] text-muted-foreground'>
          v{submission.version} <DateTimeDisplay value={String(submission.updatedAt)} />
        </p>
      </div>
    );
  };

  if (error instanceof ApiError && error.status === 403) {
    return (
      <EmptyState
        title='資料を閲覧できません'
        description='以下のいずれかに該当する可能性があります：共有状態でない / この大会に自校の出場登録がない / 選択中の大学に切り替わっていない'
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        title='資料一覧の取得に失敗しました'
        description='時間をおいて再読み込みしてください。問題が続く場合は管理者に連絡してください。'
      />
    );
  }

  if (!organizationId) {
    return <EmptyState title='大学コンテキストが必要です' />;
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h2 className='text-2xl font-bold'>資料一覧</h2>
        <Input
          placeholder='チーム名・大学名で検索...'
          defaultValue={queryParams.q}
          onChange={(e) => setQueryParams({ q: e.target.value, page: 1 })}
          className='max-w-64'
        />
      </div>

      <div className='hidden md:block overflow-auto border rounded-lg max-h-[70vh]'>
        <table className='min-w-full border-separate border-spacing-0 text-sm'>
          <caption className='sr-only'>提出資料マトリクス</caption>
          <thead>
            <tr>
              <th
                scope='col'
                className='sticky left-0 top-0 z-30 bg-muted text-left p-3 border-b border-r min-w-56'
              >
                チーム
              </th>
              {(matrix?.templates ?? []).map((template) => (
                <th
                  key={template.id}
                  scope='col'
                  className='sticky top-0 z-20 bg-muted text-left p-3 border-b border-r min-w-56'
                >
                  <p className='font-medium'>{template.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {template.acceptType === 'file' ? 'ファイル' : 'URL'}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  className='p-4 text-muted-foreground border-r'
                  colSpan={(matrix?.templates.length ?? 0) + 1}
                >
                  読み込み中...
                </td>
              </tr>
            ) : matrix?.rows.length ? (
              matrix.rows.map((row) => (
                <tr key={row.participation.id}>
                  <th
                    scope='row'
                    className='sticky left-0 z-10 bg-background p-3 border-b border-r align-top text-left font-normal'
                  >
                    <p className='text-xs text-muted-foreground'>
                      {row.participation.universityName}
                    </p>
                    <Link
                      href={`/editions/${editionId}/teams/${row.participation.id}`}
                      className='text-primary hover:underline font-medium'
                    >
                      {row.participation.teamName ?? '(チーム名なし)'}
                    </Link>
                  </th>
                  {row.cells.map((cell, index) => {
                    const template = matrix.templates[index];
                    return (
                      <td
                        key={`${row.participation.id}:${template?.id ?? index}`}
                        className='p-3 border-b border-r align-top'
                      >
                        {renderCell(cell)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className='p-4 text-muted-foreground border-r'
                  colSpan={(matrix?.templates.length ?? 0) + 1}
                >
                  表示できる提出がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className='space-y-3 md:hidden'>
        {isLoading ? (
          <p className='text-sm text-muted-foreground'>読み込み中...</p>
        ) : matrix?.rows.length ? (
          matrix.rows.map((row) => (
            <div key={row.participation.id} className='border rounded-lg p-4 space-y-3'>
              <div>
                <p className='text-xs text-muted-foreground'>{row.participation.universityName}</p>
                <Link
                  href={`/editions/${editionId}/teams/${row.participation.id}`}
                  className='text-primary hover:underline font-medium'
                >
                  {row.participation.teamName ?? '(チーム名なし)'}
                </Link>
              </div>
              <div className='space-y-3'>
                {(matrix.templates ?? []).map((template, index) => (
                  <div key={`${row.participation.id}:${template.id}`} className='space-y-1'>
                    <p className='text-xs text-muted-foreground'>{template.name}</p>
                    {renderCell(row.cells[index])}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className='text-sm text-muted-foreground'>表示できる提出がありません</p>
        )}
      </div>

      {matrix?.pagination ? (
        <div className='flex items-center justify-between gap-3 flex-wrap'>
          <p className='text-sm text-muted-foreground'>
            {matrix.pagination.total} 件中{' '}
            {Math.min(
              (matrix.pagination.page - 1) * matrix.pagination.pageSize + 1,
              matrix.pagination.total,
            )}
            -
            {Math.min(matrix.pagination.page * matrix.pagination.pageSize, matrix.pagination.total)}{' '}
            件
          </p>
          <div className='flex items-center gap-2'>
            <select
              className='h-8 rounded-md border bg-background px-2 text-sm'
              aria-label='並び順'
              value={queryParams.sort}
              onChange={(e) =>
                setQueryParams({
                  sort: e.target.value as (typeof matrixSortValues)[number],
                  page: 1,
                })
              }
            >
              {matrixSortValues.map((sortValue) => (
                <option key={sortValue} value={sortValue}>
                  {matrixSortLabelMap[sortValue]}
                </option>
              ))}
            </select>
            <select
              aria-label='1ページあたり件数'
              className='h-8 rounded-md border bg-background px-2 text-sm'
              value={queryParams.pageSize}
              onChange={(e) => setQueryParams({ pageSize: Number(e.target.value), page: 1 })}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}件
                </option>
              ))}
            </select>
            <Button
              variant='outline'
              size='sm'
              disabled={!matrix.pagination.hasPrev}
              onClick={() => setQueryParams({ page: queryParams.page - 1 })}
            >
              前へ
            </Button>
            <span className='text-sm text-muted-foreground min-w-20 text-center'>
              {matrix.pagination.page} / {matrix.pagination.totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={!matrix.pagination.hasNext}
              onClick={() => setQueryParams({ page: queryParams.page + 1 })}
            >
              次へ
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
