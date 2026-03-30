import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import type { AdminEditionsQueryParams } from './types';

export function useAdminEditionsList(queryParams: AdminEditionsQueryParams) {
  return useQuery({
    queryKey: queryKeys.admin.editions(queryParams),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions', {
        params: {
          query: {
            page: queryParams.page,
            pageSize: queryParams.pageSize,
            q: queryParams.q || undefined,
          },
        },
      });
      return throwIfError(result);
    },
  });
}

export function useSeriesForEditionForm() {
  return useQuery({
    queryKey: queryKeys.series.allForSelection(),
    queryFn: async () => {
      const result = await apiClient.GET('/api/series', {
        params: { query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });
}
