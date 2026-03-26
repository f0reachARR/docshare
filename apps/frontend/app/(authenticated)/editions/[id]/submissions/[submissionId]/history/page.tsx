'use client';

import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { apiClient, throwIfError } from '@/lib/api/client';
import type { paths } from '@/lib/api/schema';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { use } from 'react';

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

type SubmissionHistoryPath = paths['/api/submissions/{id}/history'];
type SubmissionHistoryResponse =
  SubmissionHistoryPath['get']['responses'][200]['content']['application/json'];
type HistoryRow = SubmissionHistoryResponse['data'][number];

export default function SubmissionHistoryPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { submissionId } = use(params);
  const { organizationId } = useOrganization();
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);

  const { data, isLoading } = useQuery<SubmissionHistoryResponse>({
    queryKey: queryKeys.submissions.history(submissionId, organizationId ?? '', queryParams),
    queryFn: async (): Promise<SubmissionHistoryResponse> => {
      const result = await apiClient.GET('/api/submissions/{id}/history', {
        params: {
          path: { id: submissionId },
          query: { page: queryParams.page, pageSize: queryParams.pageSize },
        },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  const historyRows = data?.data ?? [];

  const handleDownload = async (historyId: string) => {
    const result = await apiClient.GET('/api/submission-history/{historyId}/download', {
      params: { path: { historyId } },
      headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
    });
    const data = throwIfError(result);
    window.open(data.data.presignedUrl, '_blank');
  };

  const columns: ColumnDef<HistoryRow>[] = [
    { header: 'バージョン', cell: ({ row }) => `v${row.original.version}` },
    {
      header: '更新者',
      cell: ({ row }) => row.original.submittedByUser?.name ?? row.original.submittedBy,
    },
    {
      header: '更新日時',
      cell: ({ row }) => <DateTimeDisplay value={String(row.original.createdAt)} />,
    },
    {
      header: 'ファイル / URL',
      cell: ({ row }) => {
        const { id, fileName, url } = row.original;
        if (fileName) {
          return (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleDownload(id)}
              className='h-auto py-0 px-1'
            >
              <DownloadIcon className='h-3 w-3 mr-1' />
              {fileName}
            </Button>
          );
        }
        if (url) {
          return (
            <a
              href={url}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1 text-primary hover:underline text-sm'
            >
              <ExternalLinkIcon className='h-3 w-3' />
              開く
            </a>
          );
        }
        return '—';
      },
    },
  ];

  return (
    <div className='space-y-4'>
      <h1 className='text-2xl font-bold'>資料履歴</h1>
      <DataTable
        columns={columns}
        data={historyRows}
        isLoading={isLoading}
        pagination={data?.pagination}
        onPageChange={(page) => setQueryParams({ page })}
        onPageSizeChange={(pageSize) => setQueryParams({ pageSize, page: 1 })}
      />
    </div>
  );
}
