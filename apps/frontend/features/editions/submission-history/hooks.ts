import { apiClient, throwIfError } from '@/lib/api/client';
import type { paths } from '@/lib/api/schema';
import { queryKeys } from '@/lib/query/keys';
import { useQuery } from '@tanstack/react-query';

type SubmissionHistoryPath = paths['/api/submissions/{id}/history'];
export type SubmissionHistoryResponse =
  SubmissionHistoryPath['get']['responses'][200]['content']['application/json'];
export type SubmissionHistoryRow = SubmissionHistoryResponse['data'][number];

export function useSubmissionHistory(
  submissionId: string,
  organizationId: string | null,
  queryParams: { page: number; pageSize: number },
) {
  return useQuery<SubmissionHistoryResponse>({
    queryKey: queryKeys.submissions.history(submissionId, organizationId ?? '', queryParams),
    queryFn: async (): Promise<SubmissionHistoryResponse> => {
      const result = await apiClient.GET('/api/submissions/{id}/history', {
        params: {
          path: { id: submissionId },
          query: { page: queryParams.page, pageSize: queryParams.pageSize },
        },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });
}
