'use client';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CheckIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const UNIVERSITY_PAGE_SIZE = 100;

export type UniversityOption = {
  id: string;
  name: string;
  slug: string;
};

interface UniversitySelectProps {
  value: string;
  onValueChange: (id: string, university: UniversityOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UniversitySelect({
  value,
  onValueChange,
  placeholder = '大学を選択...',
  disabled = false,
}: UniversitySelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<UniversityOption | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: queryKeys.admin.universities({ q: searchQuery, pageSize: UNIVERSITY_PAGE_SIZE }),
    queryFn: async ({ pageParam = 1 }) => {
      const result = await apiClient.GET('/api/admin/universities', {
        params: {
          query: {
            page: pageParam,
            pageSize: UNIVERSITY_PAGE_SIZE,
            q: searchQuery || undefined,
          },
        },
      });
      return throwIfError(result);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
  });

  const universities = useMemo(() => {
    const allUniversities = (data?.pages ?? []).flatMap((page) => page.data) as UniversityOption[];
    const seenIds = new Set<string>();
    const deduped = allUniversities.filter((university) => {
      if (seenIds.has(university.id)) {
        return false;
      }
      seenIds.add(university.id);
      return true;
    });

    if (
      selectedUniversity &&
      !seenIds.has(selectedUniversity.id) &&
      (!value || value === selectedUniversity.id)
    ) {
      return [selectedUniversity, ...deduped];
    }

    return deduped;
  }, [data?.pages, selectedUniversity, value]);

  useEffect(() => {
    if (!value) {
      setSelectedUniversity(null);
      return;
    }

    const matchedUniversity = universities.find((university) => university.id === value);
    if (matchedUniversity) {
      setSelectedUniversity(matchedUniversity);
    }
  }, [universities, value]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const triggerLabel = selectedUniversity?.name ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant='outline' className='w-56 justify-start' disabled={disabled} />}
      >
        <span className={cn(!selectedUniversity && 'text-muted-foreground')}>{triggerLabel}</span>
      </PopoverTrigger>
      <PopoverContent className='w-56 p-0'>
        <Command shouldFilter={false}>
          <CommandInput placeholder='検索...' value={searchQuery} onValueChange={setSearchQuery} />
          <CommandList>
            {isLoading ? (
              <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
                <Loader2Icon className='h-4 w-4 animate-spin' />
                読み込み中...
              </div>
            ) : (
              <>
                <CommandEmpty>見つかりません</CommandEmpty>
                <CommandGroup>
                  {universities.map((university) => (
                    <CommandItem
                      key={university.id}
                      value={university.id}
                      onSelect={() => {
                        setSelectedUniversity(university);
                        onValueChange(university.id, university);
                        setOpen(false);
                      }}
                    >
                      {value === university.id && <CheckIcon className='h-3 w-3 mr-1' />}
                      {university.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <div ref={loadMoreRef} className='h-1' />
                {isFetchingNextPage && (
                  <div className='flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground'>
                    <Loader2Icon className='h-4 w-4 animate-spin' />
                    さらに読み込み中...
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
