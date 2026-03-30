import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminEditionsQueries } from '@/lib/query/invalidation';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { s3Put } from '@/lib/utils/file';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Edition, EditionFormValues, ExternalLink, SharingStatus } from './types';

type UploadEditionRuleVariables = {
  editionId: string;
  file: File;
  existingDocuments: { label: string; s3_key: string; mime_type: string }[];
};

export function useUpsertEditionMutation(
  editing: Edition | null,
  externalLinks: ExternalLink[],
  onClose: () => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: EditionFormValues) => {
      const body = {
        seriesId: values.seriesId,
        year: values.year,
        name: values.name,
        description: values.description,
        sharingStatus: values.sharingStatus,
        externalLinks: externalLinks.length ? externalLinks : undefined,
      };
      if (editing) {
        const result = await apiClient.PUT('/api/admin/editions/{id}', {
          params: { path: { id: editing.id } },
          body,
        });
        return throwIfError(result);
      }
      const result = await apiClient.POST('/api/admin/editions', { body });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminEditionsQueries(queryClient);
      toast.success(editing ? '更新しました' : '作成しました');
      onClose();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useDeleteEditionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/admin/editions/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      await invalidateAdminEditionsQueries(queryClient);
      toast.success('削除しました');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useChangeEditionStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SharingStatus }) => {
      const result = await apiClient.PUT('/api/admin/editions/{id}/status', {
        params: { path: { id } },
        body: { sharingStatus: status },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminEditionsQueries(queryClient);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}

export function useUploadEditionRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: UploadEditionRuleVariables) => {
      const presignResult = await apiClient.POST('/api/admin/editions/{id}/rules/presign', {
        params: { path: { id: variables.editionId } },
        body: { fileName: variables.file.name, contentType: variables.file.type },
      });
      const presign = throwIfError(presignResult);

      await s3Put(presign.data.presignedUrl, variables.file);

      const updateResult = await apiClient.PUT('/api/admin/editions/{id}/rules', {
        params: { path: { id: variables.editionId } },
        body: {
          ruleDocuments: [
            ...variables.existingDocuments,
            {
              label: variables.file.name,
              s3_key: presign.data.s3Key,
              mime_type: variables.file.type,
            },
          ],
        },
      });
      return throwIfError(updateResult);
    },
    onSuccess: async () => {
      await invalidateAdminEditionsQueries(queryClient);
      toast.success('ルール資料をアップロードしました');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
