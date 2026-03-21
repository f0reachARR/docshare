'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginationControlsProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function PaginationControls({
  pagination,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  return (
    <div className='flex items-center justify-between gap-4 flex-wrap'>
      <p className='text-sm text-muted-foreground'>
        全 {pagination.total} 件中 {(pagination.page - 1) * pagination.pageSize + 1}〜
        {Math.min(pagination.page * pagination.pageSize, pagination.total)} 件
      </p>
      <div className='flex items-center gap-2'>
        <Select
          value={String(pagination.pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className='w-24'>
            <SelectValue>{pagination.pageSize} 件</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} 件
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className='flex items-center gap-1'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(1)}
            disabled={!pagination.hasPrev}
          >
            «
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev}
          >
            ‹
          </Button>
          <span className='text-sm px-2'>
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
          >
            ›
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(pagination.totalPages)}
            disabled={!pagination.hasNext}
          >
            »
          </Button>
        </div>
      </div>
    </div>
  );
}
