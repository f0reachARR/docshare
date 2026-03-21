'use client';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import { ExternalLinkIcon, FileTextIcon } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

export default function EditionDetailPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = use(params);
  const { isAuthenticated } = useAuth();

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
    <div className='container mx-auto px-4 py-8 space-y-6 max-w-3xl'>
      <div className='space-y-2'>
        <div className='flex items-center gap-3 flex-wrap'>
          <h1 className='text-2xl font-bold'>
            {edition.year}年 {edition.name}
          </h1>
          <StatusBadge status={edition.sharingStatus} />
        </div>
        {edition.description && <p className='text-muted-foreground'>{edition.description}</p>}
      </div>

      {/* Rule documents */}
      {edition.ruleDocuments && edition.ruleDocuments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>ルール資料</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {edition.ruleDocuments.map((doc) => (
              <a
                key={doc.s3_key}
                href={doc.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 text-sm text-primary hover:underline'
              >
                <FileTextIcon className='h-4 w-4' />
                {doc.label}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* External links */}
      {edition.externalLinks && edition.externalLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>外部リンク</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {edition.externalLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2 text-sm text-primary hover:underline'
              >
                <ExternalLinkIcon className='h-4 w-4' />
                {link.label}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Auth actions */}
      {isAuthenticated && (
        <div className='flex gap-3 flex-wrap'>
          {(edition.sharingStatus === 'accepting' || edition.sharingStatus === 'sharing') && (
            <Button render={<Link href={`/editions/${editionId}/submit`} />}>資料を提出する</Button>
          )}
          {(edition.sharingStatus === 'sharing' || edition.sharingStatus === 'closed') && (
            <Button variant='outline' render={<Link href={`/editions/${editionId}/submissions`} />}>
              資料一覧を見る
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
