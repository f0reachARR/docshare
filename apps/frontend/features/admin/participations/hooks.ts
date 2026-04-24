import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminParticipationsQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';

const normalizeTeamName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const participationKey = (universityId: string, teamName: string | null | undefined): string =>
  `${universityId}:${normalizeTeamName(teamName) ?? ''}`;

export type Participation = {
  id: string;
  editionId: string;
  universityId: string;
  universityName: string;
  teamName: string | null;
  createdAt: unknown;
};

export type ParticipationDraft = {
  id: string;
  universityId: string;
  universityName: string;
  teamName: string;
};

export function useAdminParticipationsPage(editionId: string) {
  const queryClient = useQueryClient();
  const [selectedUniversityId, setSelectedUniversityId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [draftRows, setDraftRows] = useState<ParticipationDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.participations(editionId, {}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/editions/{id}/participations', {
        params: { path: { id: editionId }, query: { pageSize: 100 } },
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

  const createManyMutation = useMutation({
    mutationFn: async () => {
      const existingKeys = new Set(
        ((data?.data ?? []) as Participation[]).map((participation) =>
          participationKey(participation.universityId, participation.teamName),
        ),
      );
      const acceptedKeys = new Set(existingKeys);
      const failedRows: ParticipationDraft[] = [];
      let createdCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const row of draftRows) {
        const normalizedTeamName = normalizeTeamName(row.teamName);
        const key = participationKey(row.universityId, normalizedTeamName);

        if (acceptedKeys.has(key)) {
          skippedCount += 1;
          continue;
        }

        try {
          const result = await apiClient.POST('/api/admin/editions/{id}/participations', {
            params: { path: { id: editionId } },
            body: {
              universityId: row.universityId,
              teamName: normalizedTeamName ?? undefined,
            },
          });
          throwIfError(result);
          acceptedKeys.add(key);
          createdCount += 1;
        } catch {
          failedRows.push(row);
          failedCount += 1;
        }
      }

      return { createdCount, skippedCount, failedCount, failedRows };
    },
    onSuccess: async ({ createdCount, skippedCount, failedCount, failedRows }) => {
      await invalidateAdminParticipationsQueries(queryClient, editionId);
      setDraftRows(failedRows);

      const message = `登録成功 ${createdCount}件 / スキップ ${skippedCount}件 / 失敗 ${failedCount}件`;
      if (failedCount > 0) {
        toast.error(message);
        return;
      }

      toast.success(message);
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

  const addDraftRows = (
    universities: Array<{ id: string; name: string }>,
    createId: () => string = crypto.randomUUID,
  ) => {
    setDraftRows((current) => [
      ...current,
      ...universities.map((university) => ({
        id: createId(),
        universityId: university.id,
        universityName: university.name,
        teamName: '',
      })),
    ]);
  };

  const updateDraftTeamName = (id: string, value: string) => {
    setDraftRows((current) =>
      current.map((row) => (row.id === id ? { ...row, teamName: value } : row)),
    );
  };

  const removeDraftRow = (id: string) => {
    setDraftRows((current) => current.filter((row) => row.id !== id));
  };

  return {
    selectedUniversityId,
    setSelectedUniversityId,
    teamName,
    setTeamName,
    draftRows,
    addDraftRows,
    updateDraftTeamName,
    removeDraftRow,
    editingId,
    setEditingId,
    editingTeamName,
    setEditingTeamName,
    data,
    isLoading,
    createMutation,
    createManyMutation,
    updateMutation,
    deleteMutation,
  };
}
