import { useOrganization } from '@/contexts/OrganizationContext';
import { apiClient, throwIfError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { useQueries, useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  const { organizationId, currentOrg } = useOrganization();

  const { data: editionsData, isLoading: editionsLoading } = useQuery({
    queryKey: queryKeys.editions.all({ pageSize: 50 }),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions', {
        params: { query: { pageSize: 50 } },
      });
      return throwIfError(result);
    },
  });

  const editions = editionsData?.data ?? [];

  const statusQueries = useQueries({
    queries: editions.map((edition) => ({
      queryKey: queryKeys.editions.mySubmissionStatus(edition.id, organizationId ?? ''),
      queryFn: async () => {
        if (!organizationId) {
          return null;
        }

        const result = await apiClient.GET('/api/editions/{id}/my-submission-status', {
          params: { path: { id: edition.id } },
          headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
        });

        if (result.response.status === 403 || result.response.status === 404) {
          return null;
        }

        return throwIfError(result);
      },
      enabled: !!organizationId,
    })),
  });

  const myEditions = editions
    .map((edition, index) => ({ edition, status: statusQueries[index]?.data }))
    .filter(({ status }) => status && (status.data?.participations?.length ?? 0) > 0);

  const isLoading = editionsLoading || statusQueries.some((query) => query.isLoading);

  return {
    organizationId,
    currentOrg,
    myEditions,
    isLoading,
  };
}
