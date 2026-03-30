import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';

export function useAdminTemplates(editionId: string) {
  return useQuery({
    queryKey: queryKeys.admin.templates(editionId, { pageSize: 100 }),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions/{id}/templates', {
        params: { path: { id: editionId }, query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });
}

export function useEditionsForTemplateCopy() {
  return useQuery({
    queryKey: queryKeys.editions.allForSelection(),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions', {
        params: { query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });
}
