'use client';

import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/ui/input';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { use } from 'react';

type SubmissionRow = {
  submission: {
    id: string;
    templateId: string;
    participationId: string;
    submittedBy: string;
    version: number;
    fileName: string | null;
    fileSizeBytes: number | null;
    fileMimeType: string | null;
    url: string | null;
    createdAt: unknown;
    updatedAt: unknown;
  };
  participation: {
    id: string;
    editionId: string;
    universityId: string;
    universityName: string;
    teamName: string | null;
    createdAt: unknown;
  };
};

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  q: parseAsString.withDefault(''),
  sort: parseAsString.withDefault(''),
};

export default function SubmissionsListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { organizationId } = useOrganization();
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.editions.submissions(id, organizationId ?? '', queryParams),
    queryFn: async () => {
      if (!organizationId) throw new Error('大学コンテキストが必要です');
      const result = await apiClient.GET('/api/editions/{id}/submissions', {
        params: {
          path: { id },
          query: {
            page: queryParams.page,
            pageSize: queryParams.pageSize,
            q: queryParams.q || undefined,
          },
        },
        headers: { 'X-Organization-Id': organizationId },
      });
      return throwIfError(result);
    },
    enabled: !!organizationId,
  });

  const columns: ColumnDef<SubmissionRow>[] = [
    {
      header: '大学',
      cell: ({ row }) => row.original.participation.universityName,
    },
    {
      header: 'チーム',
      cell: ({ row }) =>
        row.original.participation.teamName ? (
          <Link
            href={`/editions/${id}/teams/${row.original.participation.id}`}
            className='text-primary hover:underline'
          >
            {row.original.participation.teamName}
          </Link>
        ) : (
          <Link
            href={`/editions/${id}/teams/${row.original.participation.id}`}
            className='text-primary hover:underline'
          >
            (チーム名なし)
          </Link>
        ),
    },
    {
      header: 'ファイル / URL',
      cell: ({ row }) => {
        const { submission } = row.original;
        if (submission.fileName) return <span className='text-sm'>{submission.fileName}</span>;
        if (submission.url)
          return (
            <a
              href={submission.url}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline text-sm truncate max-w-40 block'
            >
              {submission.url}
            </a>
          );
        return '—';
      },
    },
    {
      header: 'バージョン',
      cell: ({ row }) => `v${row.original.submission.version}`,
    },
    {
      header: '更新日時',
      cell: ({ row }) => <DateTimeDisplay value={String(row.original.submission.updatedAt)} />,
    },
  ];

  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className='space-y-4'>
        <h1 className='text-2xl font-bold'>資料一覧</h1>
        <EmptyState
          title='資料を閲覧できません'
          description='以下のいずれかに該当する可能性があります：共有状態でない / 自校がまだ資料を提出していない / この大会に自校の出場登録がない'
        />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3 flex-wrap'>
        <h1 className='text-2xl font-bold'>資料一覧</h1>
        <Input
          placeholder='チーム名・大学名で検索...'
          defaultValue={queryParams.q}
          onChange={(e) => setQueryParams({ q: e.target.value, page: 1 })}
          className='max-w-64'
        />
      </div>

      <DataTable
        columns={columns}
        data={(data?.data ?? []) as SubmissionRow[]}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams({ page })}
        onPageSizeChange={(pageSize) => setQueryParams({ pageSize, page: 1 })}
        renderCard={(row) => (
          <div className='border rounded-lg p-4 space-y-1 text-sm'>
            <p className='font-medium'>
              {row.participation.universityName}
              {row.participation.teamName && ` / ${row.participation.teamName}`}
            </p>
            <p className='text-muted-foreground'>
              {row.submission.fileName ?? row.submission.url ?? '—'}
            </p>
            <p className='text-muted-foreground text-xs'>
              v{row.submission.version} ·{' '}
              <DateTimeDisplay value={String(row.submission.updatedAt)} />
            </p>
          </div>
        )}
      />
    </div>
  );
}
