import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminParticipationsQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

export type Participation = {
  id: string;
  editionId: string;
  universityId: string;
  universityName: string;
  teamName: string | null;
  createdAt: unknown;
};

export function useAdminParticipationsPage(editionId: string) {
  const queryClient = useQueryClient();
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.participations(editionId, {}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/editions/{id}/participations', {
        params: { path: { id: editionId } },
      });
      return throwIfError(result);
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient.POST('/api/admin/editions/{id}/participations', {
        params: { path: { id: editionId } },
        body: { universityId: selectedUniversityId, teamName: teamName || undefined },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminParticipationsQueries(queryClient, editionId);
      setSelectedUniversityId('');
      setTeamName('');
      toast.success('出場登録しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, teamName }: { id: string; teamName: string | null }) => {
      const result = await apiClient.PUT('/api/admin/participations/{id}', {
        params: { path: { id } },
        body: { teamName: teamName || null },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminParticipationsQueries(queryClient, editionId);
      setEditingId(null);
      toast.success('更新しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.DELETE('/api/admin/participations/{id}', {
        params: { path: { id } },
      });
      if (!result.response.ok) {
        throw new ApiError(result.response.status, result.error);
      }
    },
    onSuccess: async () => {
      await invalidateAdminParticipationsQueries(queryClient, editionId);
      toast.success('削除しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return {
    selectedUniversityId,
    setSelectedUniversityId,
    teamName,
    setTeamName,
    editingId,
    setEditingId,
    editingTeamName,
    setEditingTeamName,
    data,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
