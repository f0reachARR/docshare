'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, PlusIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { UniversityOption } from './UniversitySelect';

const UNIVERSITY_PAGE_SIZE = 100;

type UniversityMultiSelectProps = {
  onAdd: (universities: UniversityOption[]) => void;
  disabled?: boolean;
};

export function UniversityMultiSelect({ onAdd, disabled = false }: UniversityMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversities, setSelectedUniversities] = useState<UniversityOption[]>([]);
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
    return allUniversities.filter((university) => {
      if (seenIds.has(university.id)) {
        return false;
      }
      seenIds.add(university.id);
      return true;
    });
  }, [data?.pages]);

  const selectedIds = useMemo(
    () => new Set(selectedUniversities.map((university) => university.id)),
    [selectedUniversities],
  );

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

  const toggleUniversity = (university: UniversityOption) => {
    setSelectedUniversities((current) => {
      if (current.some((item) => item.id === university.id)) {
        return current.filter((item) => item.id !== university.id);
      }
      return [...current, university];
    });
  };

  const handleAdd = () => {
    if (selectedUniversities.length === 0) {
      return;
    }

    onAdd(selectedUniversities);
    setSelectedUniversities([]);
    setSearchQuery('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant='outline' className='w-72 justify-between' disabled={disabled} />}
      >
        <span className={cn(selectedUniversities.length === 0 && 'text-muted-foreground')}>
          {selectedUniversities.length === 0
            ? '大学を複数選択...'
            : `${selectedUniversities.length}校を選択中`}
        </span>
        <ChevronsUpDownIcon className='h-4 w-4 opacity-50' />
      </PopoverTrigger>
      <PopoverContent className='w-72 p-0'>
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
                  {universities.map((university) => {
                    const selected = selectedIds.has(university.id);
                    return (
                      <CommandItem
                        key={university.id}
                        value={university.id}
                        data-checked={selected}
                        onSelect={() => toggleUniversity(university)}
                      >
                        <span className='flex h-4 w-4 items-center justify-center rounded-sm border border-border'>
                          {selected && <CheckIcon className='h-3 w-3' />}
                        </span>
                        <span className='min-w-0 truncate'>{university.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <div ref={loadMoreRef} className='h-1' />
                {hasNextPage && !isFetchingNextPage && (
                  <div className='px-2 pb-2'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='w-full'
                      onClick={() => fetchNextPage()}
                    >
                      さらに読み込む
                    </Button>
                  </div>
                )}
                {isFetchingNextPage && (
                  <div className='flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground'>
                    <Loader2Icon className='h-4 w-4 animate-spin' />
                    さらに読み込み中...
                  </div>
                )}
              </>
            )}
          </CommandList>
          <div className='flex items-center justify-between gap-2 border-t p-2'>
            <span className='text-xs text-muted-foreground'>
              {selectedUniversities.length}校選択
            </span>
            <Button
              type='button'
              size='sm'
              onClick={handleAdd}
              disabled={selectedUniversities.length === 0}
            >
              <PlusIcon className='h-3 w-3' />
              候補に追加
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
