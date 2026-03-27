import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';

export type CompetitionsListParams = {
  page: number;
  pageSize: number;
  q: string;
};

export function useCompetitionsSeries(params: CompetitionsListParams) {
  return useQuery({
    queryKey: queryKeys.series.all(params),
    queryFn: async () => {
      const result = await apiClient.GET('/api/series', {
        params: {
          query: { page: params.page, pageSize: params.pageSize, q: params.q || undefined },
        },
      });
      return throwIfError(result);
    },
  });
}

export function useCompetitionsEditions() {
  return useQuery({
    queryKey: queryKeys.editions.all({ pageSize: 100 }),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions', {
        params: { query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });
}
