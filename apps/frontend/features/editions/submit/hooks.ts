import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateSubmissionStatusQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { s3Put, validateFile } from '@/lib/utils/file';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

export type TemplateItem = {
  id: string;
  name: string;
  description?: string | null;
  acceptType: 'file' | 'url';
  isRequired: boolean;
  allowedExtensions: string[] | null;
  urlPattern: string | null;
  maxFileSizeMb: number;
  sortOrder: number;
};

export type StatusItem = {
  participationId: string;
  templateId: string;
  submission: {
    id: string;
    version: number;
    fileName: string | null;
    url: string | null;
    updatedAt?: unknown;
  } | null;
};

export function useSubmitPageData(id: string) {
  const { user } = useAuth();
  const { organizationId, currentOrg } = useOrganization();
  const [selectedParticipationId, setSelectedParticipationId] = useState<string | null>(null);

  const { data: editionData, isLoading: isEditionLoading } = useQuery({
    queryKey: queryKeys.editions.detail(id),
    queryFn: async () => {
      const result = await apiClient.GET('/api/editions/{id}', {
        params: { path: { id } },
      });
      return throwIfError(result);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.editions.mySubmissionStatus(id, organizationId ?? ''),
    queryFn: async () => {
      if (!organizationId) {
        return null;
      }
      const result = await apiClient.GET('/api/editions/{id}/my-submission-status', {
        params: { path: { id } },
        headers: { 'X-Organization-Id': organizationId },
      });
      return throwIfError(result);
    },
    enabled: !!organizationId,
  });

  const statusData = data?.data;
  const participations = statusData?.participations ?? [];
  const templates = statusData?.templates ?? [];
  const items = statusData?.items ?? [];
  const sharingStatus = statusData?.edition?.sharingStatus;
  const edition = editionData?.data;

  const activeParticipationId =
    participations.length === 1 ? (participations[0]?.id ?? null) : selectedParticipationId;

  const canDelete = !!(currentOrg?.role === 'owner' || user?.isAdmin);

  return {
    user,
    organizationId,
    selectedParticipationId,
    setSelectedParticipationId,
    isEditionLoading,
    isLoading,
    statusData,
    participations,
    templates,
    items,
    sharingStatus,
    edition,
    activeParticipationId,
    canDelete,
  };
}

export function useTemplateSubmissionMutations({
  editionId,
  participationId,
  template,
  submission,
  organizationId,
  onSuccess,
  setUploadProgress,
}: {
  editionId: string;
  participationId: string;
  template: TemplateItem;
  submission: StatusItem['submission'] | null;
  organizationId: string;
  onSuccess: () => void;
  setUploadProgress: (value: number | null) => void;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!submission) {
        return;
      }
      const result = await apiClient.DELETE('/api/submissions/{id}', {
        params: { path: { id: submission.id } },
        headers: { 'X-Organization-Id': organizationId },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      toast.success('資料を削除しました');
      await invalidateSubmissionStatusQueries(
        queryClient,
        editionId,
        participationId,
        organizationId,
        submission?.id,
      );
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'submission'));
    },
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const validation = validateFile(file, template);
      if (!validation.ok) {
        throw new Error(validation.message);
      }

      const presignResult = await apiClient.POST('/api/upload/presign', {
        body: {
          participationId,
          templateId: template.id,
          fileName: file.name,
          contentType: file.type,
          fileSizeBytes: file.size,
        },
        headers: { 'X-Organization-Id': organizationId },
      });
      const presign = throwIfError(presignResult);

      setUploadProgress(0);
      await s3Put(presign.data.presignedUrl, file, setUploadProgress);

      const body = {
        s3Key: presign.data.s3Key,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type,
      };

      if (submission) {
        const result = await apiClient.PUT('/api/submissions/{id}', {
          params: { path: { id: submission.id } },
          body,
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(result);
      } else {
        const result = await apiClient.POST('/api/submissions', {
          body: { ...body, templateId: template.id, participationId },
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(result);
      }
    },
    onSuccess: async () => {
      setUploadProgress(null);
      toast.success('資料をアップロードしました');
      await invalidateSubmissionStatusQueries(
        queryClient,
        editionId,
        participationId,
        organizationId,
        submission?.id,
      );
      onSuccess();
    },
    onError: (err) => {
      setUploadProgress(null);
      toast.error(err instanceof Error ? err.message : getApiErrorMessage(err, 'submission'));
    },
  });

  const submitUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      if (submission) {
        const result = await apiClient.PUT('/api/submissions/{id}', {
          params: { path: { id: submission.id } },
          body: { url },
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(result);
      } else {
        const result = await apiClient.POST('/api/submissions', {
          body: { url, templateId: template.id, participationId },
          headers: { 'X-Organization-Id': organizationId },
        });
        throwIfError(result);
      }
    },
    onSuccess: async () => {
      toast.success('URLを登録しました');
      await invalidateSubmissionStatusQueries(
        queryClient,
        editionId,
        participationId,
        organizationId,
        submission?.id,
      );
      onSuccess();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'submission'));
    },
  });

  return {
    deleteMutation,
    uploadFileMutation,
    submitUrlMutation,
  };
}
