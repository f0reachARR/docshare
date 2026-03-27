import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminSeriesQueries } from '@/lib/query/invalidation';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ExternalLink, Series, SeriesFormValues } from './types';

export function useUpsertSeriesMutation(
  editing: Series | null,
  externalLinks: ExternalLink[],
  onClose: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: SeriesFormValues) => {
      const body = {
        name: values.name,
        description: values.description,
        externalLinks: externalLinks.length ? externalLinks : undefined,
      };
      if (editing) {
        const result = await apiClient.PUT('/api/admin/series/{id}', {
          params: { path: { id: editing.id } },
          body,
        });
        return throwIfError(result);
      }
      const result = await apiClient.POST('/api/admin/series', { body });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminSeriesQueries(queryClient);
      toast.success(editing ? '更新しました' : '作成しました');
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeleteSeriesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/admin/series/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      await invalidateAdminSeriesQueries(queryClient);
      toast.success('削除しました');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
