'use client';

import { DataTable } from '@/components/common/DataTable';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  type SubmissionHistoryRow,
  useSubmissionHistory,
} from '@/features/editions/submission-history/hooks';
import { apiClient, throwIfError } from '@/lib/api/client';
import type { ColumnDef } from '@tanstack/react-table';
import { DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { use } from 'react';

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
};

export default function SubmissionHistoryPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { submissionId } = use(params);
  const { organizationId } = useOrganization();
  const [queryParams, setQueryParams] = useQueryStates(paginationParsers);

  const { data, isLoading } = useSubmissionHistory(submissionId, organizationId, queryParams);

  const historyRows = data?.data ?? [];

  const handleDownload = async (historyId: string) => {
    const result = await apiClient.GET('/api/submission-history/{historyId}/download', {
      params: { path: { historyId } },
      headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
    });
    const data = throwIfError(result);
    window.open(data.data.presignedUrl, '_blank');
  };

  const columns: ColumnDef<SubmissionHistoryRow>[] = [
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
              className='flex items-center gap-1 text-primary cursor-pointer'
            >
              <DownloadIcon className='h-3 w-3 mr-1' />
              {fileName ?? 'ダウンロード'}
            </Button>
          );
        }
        if (url) {
          return (
            <a
              href={url}
              target='_blank'
              rel='noopener noreferrer'
              className='flex items-center gap-1 text-primary hover:underline px-3.5 py-1.5'
            >
              <ExternalLinkIcon className='h-3 w-3 mr-1' />
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
