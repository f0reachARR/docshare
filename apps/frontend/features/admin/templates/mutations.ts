import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminTemplatesQueries } from '@/lib/query/invalidation';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Template, TemplateFormValues } from './types';

export function useUpsertTemplateMutation(
  editionId: string,
  editing: Template | null,
  onClose: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      const body = {
        name: values.name,
        description: values.description,
        acceptType: values.acceptType,
        allowedExtensions:
          values.acceptType === 'file' && values.allowedExtensions
            ? values.allowedExtensions
                .split(',')
                .map((extension) => extension.trim())
                .filter(Boolean)
            : undefined,
        urlPattern: values.acceptType === 'url' ? values.urlPattern : undefined,
        maxFileSizeMb: values.maxFileSizeMb,
        isRequired: values.isRequired,
        sortOrder: values.sortOrder,
      };

      if (editing) {
        const result = await apiClient.PUT('/api/admin/templates/{id}', {
          params: { path: { id: editing.id } },
          body,
        });
        return throwIfError(result);
      }

      const result = await apiClient.POST('/api/admin/editions/{id}/templates', {
        params: { path: { id: editionId } },
        body,
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminTemplatesQueries(queryClient, editionId);
      toast.success(editing ? '更新しました' : '作成しました');
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeleteTemplateMutation(editionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/admin/templates/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      await invalidateAdminTemplatesQueries(queryClient, editionId);
      toast.success('削除しました');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useCopyTemplatesMutation(editionId: string, onSuccessCopy: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sourceEditionId: string) => {
      const result = await apiClient.POST(
        '/api/admin/editions/{id}/templates/copy-from/{sourceEditionId}',
        {
          params: { path: { id: editionId, sourceEditionId } },
        },
      );
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminTemplatesQueries(queryClient, editionId);
      toast.success('テンプレートをコピーしました');
      onSuccessCopy();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
