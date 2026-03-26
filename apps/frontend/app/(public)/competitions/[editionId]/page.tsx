'use client';

import { EmptyState } from '@/components/common/EmptyState';
import { EditionOverview } from '@/components/editions/EditionOverview';
import { EditionSubmissionMatrix } from '@/components/editions/EditionSubmissionMatrix';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { use } from 'react';

export default function EditionDetailPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = use(params);
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const loginHref = `/auth/login?callbackUrl=${encodeURIComponent(`/competitions/${editionId}`)}`;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.editions.detail(editionId),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions/{id}', {
        params: { path: { id: editionId } },
      });
      return throwIfError(result);
    },
  });

  const edition = data?.data;

  if (isLoading) {
    return (
      <div className='container mx-auto px-4 py-8 space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-3/4' />
      </div>
    );
  }

  if (!edition) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <p className='text-muted-foreground'>大会回が見つかりません</p>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8 space-y-8 max-w-7xl'>
      <EditionOverview
        edition={edition}
        actions={
          isAuthenticated &&
          (edition.sharingStatus === 'accepting' || edition.sharingStatus === 'sharing') ? (
            <Button render={<Link href={`/editions/${editionId}/submit`} />}>資料を提出する</Button>
          ) : null
        }
      />

      {isAuthLoading ? (
        <div className='space-y-4'>
          <Skeleton className='h-8 w-40' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-80 w-full' />
        </div>
      ) : isAuthenticated ? (
        <EditionSubmissionMatrix editionId={editionId} />
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              title='資料一覧を見るにはログインが必要です'
              description='ログインすると、この大会に対して閲覧可能な資料が同じページ内に表示されます。'
              action={<Button render={<Link href={loginHref} />}>ログインへ進む</Button>}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
