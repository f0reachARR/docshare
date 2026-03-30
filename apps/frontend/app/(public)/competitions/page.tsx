'use client';

import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCompetitionsEditions,
  useCompetitionsSeries,
} from '@/features/public/competitions/query';
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useState } from 'react';

const paginationParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(10),
  q: parseAsString.withDefault(''),
};

export default function CompetitionsPage() {
  const [params, setParams] = useQueryStates(paginationParsers);
  const [expandedSeries, setExpandedSeries] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useCompetitionsSeries(params);
  const { data: allEditions } = useCompetitionsEditions();

  const handleSearch = (q: string) => {
    setParams({ q, page: 1 });
  };

  const toggleSeries = (id: string) => {
    setExpandedSeries((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  return (
    <div className='container mx-auto px-4 py-8 space-y-6'>
      <div className='flex items-center justify-between gap-4 flex-wrap'>
        <h1 className='text-2xl font-bold'>大会シリーズ一覧</h1>
        <Input
          placeholder='シリーズ名で検索...'
          defaultValue={params.q}
          onChange={(e) => handleSearch(e.target.value)}
          className='max-w-64'
        />
      </div>

      {isLoading ? (
        <div className='space-y-3'>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={i} className='h-16' />
          ))}
        </div>
      ) : (
        <div className='space-y-3'>
          {(data?.data ?? []).map((series) => {
            const editions = (allEditions?.data ?? []).filter((e) => e.seriesId === series.id);
            const isExpanded = expandedSeries[series.id] ?? true;

            return (
              <Card key={series.id}>
                <CardHeader className='py-4'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex-1 min-w-0'>
                      <CardTitle className='text-base'>{series.name}</CardTitle>
                      {series.description && (
                        <p className='text-sm text-muted-foreground mt-1 truncate'>
                          {series.description}
                        </p>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      {(series.externalLinks ?? []).map((link) => (
                        <Button
                          key={link.url}
                          variant='ghost'
                          size='sm'
                          render={(props) => (
                            <a href={link.url} target='_blank' rel='noopener noreferrer'>
                              {props.children}
                            </a>
                          )}
                        >
                          <ExternalLinkIcon className='h-3 w-3' />
                          <span className='hidden md:inline ml-1'>{link.label}</span>
                        </Button>
                      ))}
                      {editions.length > 0 && (
                        <Button variant='ghost' size='sm' onClick={() => toggleSeries(series.id)}>
                          {isExpanded ? (
                            <ChevronDownIcon className='h-4 w-4' />
                          ) : (
                            <ChevronRightIcon className='h-4 w-4' />
                          )}
                          <span className='ml-1'>{editions.length}回</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && editions.length > 0 && (
                  <CardContent className='pt-0'>
                    <div className='border-t pt-3 space-y-2'>
                      {editions.map((edition) => (
                        <div
                          key={edition.id}
                          className='flex items-center justify-between gap-3 py-1.5'
                        >
                          <Link
                            href={`/competitions/${edition.id}`}
                            className='text-sm font-medium underline'
                          >
                            {edition.year}年 {edition.name}
                          </Link>
                          <StatusBadge status={edition.sharingStatus} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className='flex justify-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            disabled={!data.pagination.hasPrev}
            onClick={() => setParams({ page: params.page - 1 })}
          >
            前へ
          </Button>
          <span className='text-sm py-2'>
            {params.page} / {data.pagination.totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={!data.pagination.hasNext}
            onClick={() => setParams({ page: params.page + 1 })}
          >
            次へ
          </Button>
        </div>
      )}
    </div>
  );
}
