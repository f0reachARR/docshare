import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';

export function useCompetitionDetail(editionId: string) {
  return useQuery({
    queryKey: queryKeys.editions.detail(editionId),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions/{id}', {
        params: { path: { id: editionId } },
      });
      return throwIfError(result);
    },
  });
}
