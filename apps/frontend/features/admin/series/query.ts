import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';
import type { AdminSeriesQueryParams } from './types';

export function useAdminSeriesList(queryParams: AdminSeriesQueryParams) {
  return useQuery({
    queryKey: queryKeys.admin.series(queryParams),
    queryFn: async () => {
      const result = await apiClient.GET('/api/series', {
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
