import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateParticipationCommentsQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type TeamSubmissionQueryParams = {
  page: number;
  pageSize: number;
};

export function useTeamDetailData(
  participationId: string,
  submissionParams: TeamSubmissionQueryParams,
) {
  const { organizationId } = useOrganization();
  const { user } = useAuth();

  const { data: participation, isLoading: participationLoading } = useQuery({
    queryKey: queryKeys.participations.detail(participationId, organizationId ?? ''),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participations/{id}', {
        params: { path: { id: participationId } },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: queryKeys.participations.submissions(
      participationId,
      organizationId ?? '',
      submissionParams,
    ),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participations/{id}/submissions', {
        params: {
          path: { id: participationId },
          query: { page: submissionParams.page, pageSize: submissionParams.pageSize },
        },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  const {
    data: comments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useQuery({
    queryKey: queryKeys.participations.comments(participationId, organizationId ?? '', {}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participations/{id}/comments', {
        params: { path: { id: participationId }, query: { pageSize: 100 } },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
  });

  return {
    organizationId,
    user,
    participation,
    participationLoading,
    submissions,
    submissionsLoading,
    comments,
    commentsLoading,
    commentsError,
  };
}

export function useTeamCommentMutations({
  participationId,
  organizationId,
  onPostSuccess,
  onUpdateSuccess,
}: {
  participationId: string;
  organizationId: string;
  onPostSuccess: () => void;
  onUpdateSuccess: () => void;
}) {
  const queryClient = useQueryClient();

  const postCommentMutation = useMutation({
    mutationFn: async (body: string) => {
      const result = await apiClient.POST('/api/participations/{id}/comments', {
        params: { path: { id: participationId } },
        body: { body },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      onPostSuccess();
      await invalidateParticipationCommentsQueries(queryClient, participationId, organizationId);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const result = await apiClient.PUT('/api/comments/{id}', {
        params: { path: { id } },
        body: { body },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      onUpdateSuccess();
      await invalidateParticipationCommentsQueries(queryClient, participationId, organizationId);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/comments/{id}', {
        params: { path: { id } },
        headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      await invalidateParticipationCommentsQueries(queryClient, participationId, organizationId);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return {
    postCommentMutation,
    updateCommentMutation,
    deleteCommentMutation,
  };
}

export async function downloadSubmission(
  submissionId: string,
  organizationId: string,
): Promise<void> {
  const result = await apiClient.GET('/api/submissions/{id}/download', {
    params: { path: { id: submissionId } },
    headers: organizationId ? { 'X-Organization-Id': organizationId } : {},
  });
  const data = throwIfError(result);
  window.open(data.data.presignedUrl, '_blank');
}
