'use client';

import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const { organizationId, currentOrg } = useOrganization();

  // Fetch all non-draft editions
  const { data: editionsData, isLoading: editionsLoading } = useQuery({
    queryKey: queryKeys.editions.all({ pageSize: 50 }),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions', {
        params: { query: { pageSize: 50 } },
      });
      return throwIfError(result);
    },
  });

  const editions = editionsData?.data ?? [];

  // Fetch my-submission-status for each edition (parallel)
  const statusQueries = useQueries({
    queries: editions.map((edition) => ({
      queryKey: queryKeys.editions.mySubmissionStatus(edition.id, organizationId ?? ''),
      queryFn: async () => {
        if (!organizationId) return null;
        const result = await apiClient.GET('/api/editions/{id}/my-submission-status', {
          params: { path: { id: edition.id } },
          headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
        });
        if (result.response.status === 403 || result.response.status === 404) return null;
        return throwIfError(result);
      },
      enabled: !!organizationId,
    })),
  });

  // Filter editions where my university has participations
  const myEditions = editions
    .map((edition, i) => ({ edition, status: statusQueries[i]?.data }))
    .filter(({ status }) => status && (status.data?.participations?.length ?? 0) > 0);

  const isLoading = editionsLoading || statusQueries.some((q) => q.isLoading);

  if (!organizationId && !isLoading) {
    return (
      <div className='space-y-4'>
        <h1 className='text-2xl font-bold'>ダッシュボード</h1>
        <EmptyState
          title='大学に所属していません'
          description='大学の代表者から招待リンクを受け取って、大学に参加してください。'
        />
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>ダッシュボード</h1>
        {currentOrg && <p className='text-muted-foreground mt-1'>{currentOrg.name}</p>}
      </div>

      {isLoading ? (
        <div className='grid md:grid-cols-2 gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={i} className='h-40' />
          ))}
        </div>
      ) : myEditions.length === 0 ? (
        <EmptyState
          title='出場登録されている大会がありません'
          description='管理者から出場登録された大会がここに表示されます。'
          action={
            <Button variant='outline' render={<Link href='/competitions' />}>
              大会一覧を見る
            </Button>
          }
        />
      ) : (
        <div className='grid md:grid-cols-2 gap-4'>
          {myEditions.map(({ edition, status }) => {
            const participations = status?.data?.participations ?? [];
            const items = status?.data?.items ?? [];
            const templates = status?.data?.templates ?? [];
            const submittedCount = items.filter((i) => i.submission !== null).length;

            return (
              <Card key={edition.id}>
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-base'>
                      {edition.year}年 {edition.name}
                    </CardTitle>
                    <StatusBadge status={edition.sharingStatus} />
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <p className='text-sm text-muted-foreground'>
                    提出: {submittedCount} / {templates.length} テンプレート
                    {participations.length > 1 && ` (${participations.length}チーム)`}
                  </p>
                  <div className='flex gap-2 flex-wrap'>
                    <Button size='sm' render={<Link href={`/editions/${edition.id}/submit`} />}>
                      資料提出
                    </Button>
                    {(edition.sharingStatus === 'sharing' ||
                      edition.sharingStatus === 'closed') && (
                      <Button
                        size='sm'
                        variant='outline'
                        render={<Link href={`/editions/${edition.id}/submissions`} />}
                      >
                        資料一覧
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
