import { createApiClient } from './api-client';
import type {
  ApiResponse,
  CommentItem,
  CompetitionEdition,
  CompetitionSeries,
  MeResponse,
  Participation,
  Submission,
  SubmissionHistory,
  SubmissionTemplate,
} from './types';

const FALLBACK_API_URL = 'http://localhost:8787/api';

const getBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL ?? FALLBACK_API_URL;
};

export const createAppApi = (getOrganizationId: () => string | null) => {
  const client = createApiClient({
    baseUrl: getBaseUrl(),
    getOrganizationId,
  });

  return {
    getMe: () => client.get<ApiResponse<MeResponse>>('/me'),
    listSeries: () => client.get<ApiResponse<CompetitionSeries[]>>('/series'),
    listEditions: (seriesId?: string) =>
      client.get<ApiResponse<CompetitionEdition[]>>(
        seriesId ? `/editions?series_id=${encodeURIComponent(seriesId)}` : '/editions',
      ),
    getEdition: (id: string) => client.get<ApiResponse<CompetitionEdition>>(`/editions/${id}`),
    getTemplates: (editionId: string) =>
      client.get<ApiResponse<SubmissionTemplate[]>>(`/editions/${editionId}/templates`),
    getMySubmissions: (editionId: string) =>
      client.get<ApiResponse<Submission[]>>(`/editions/${editionId}/my-submissions`),
    getMyParticipation: (editionId: string) =>
      client.get<ApiResponse<Participation>>(`/editions/${editionId}/my-participation`),
    listEditionSubmissions: (editionId: string) =>
      client.get<
        ApiResponse<
          Array<{
            submission: Submission;
            participation: Participation;
          }>
        >
      >(`/editions/${editionId}/submissions`),
    createSubmission: (payload: unknown) =>
      client.post<ApiResponse<Submission>>('/submissions', payload),
    updateSubmission: (submissionId: string, payload: unknown) =>
      client.put<ApiResponse<Submission>>(`/submissions/${submissionId}`, payload),
    getSubmissionHistory: (submissionId: string) =>
      client.get<ApiResponse<SubmissionHistory[]>>(`/submissions/${submissionId}/history`),
    getSubmissionDownload: (submissionId: string) =>
      client.get<ApiResponse<{ url: string }>>(`/submissions/${submissionId}/download`),
    getHistoryDownload: (historyId: string) =>
      client.get<ApiResponse<{ url: string }>>(`/submission-history/${historyId}/download`),
    listComments: (participationId: string) =>
      client.get<ApiResponse<CommentItem[]>>(`/participations/${participationId}/comments`),
    createComment: (participationId: string, body: string) =>
      client.post<ApiResponse<CommentItem>>(`/participations/${participationId}/comments`, {
        body,
      }),
    updateComment: (commentId: string, body: string) =>
      client.put<ApiResponse<CommentItem>>(`/comments/${commentId}`, { body }),
    deleteComment: (commentId: string) => client.delete<void>(`/comments/${commentId}`),
    createInvite: (email: string, role: 'owner' | 'member') =>
      client.post<ApiResponse<{ id: string }>>('/university/invite', {
        email,
        role,
      }),
    listMembers: () =>
      client.get<
        ApiResponse<
          Array<{
            id: string;
            userId: string;
            role: 'owner' | 'member';
            name: string;
            email: string;
          }>
        >
      >('/university/members'),
    updateMemberRole: (memberId: string, role: 'owner' | 'member') =>
      client.put<ApiResponse<{ id: string }>>(`/university/members/${memberId}/role`, { role }),
    removeMember: (memberId: string) => client.delete<void>(`/university/members/${memberId}`),
    adminCreateSeries: (payload: unknown) =>
      client.post<ApiResponse<CompetitionSeries>>('/admin/series', payload),
    adminUpdateSeries: (id: string, payload: unknown) =>
      client.put<ApiResponse<CompetitionSeries>>(`/admin/series/${id}`, payload),
    adminDeleteSeries: (id: string) => client.delete<void>(`/admin/series/${id}`),
    adminCreateEdition: (payload: unknown) =>
      client.post<ApiResponse<CompetitionEdition>>('/admin/editions', payload),
    adminUpdateEdition: (id: string, payload: unknown) =>
      client.put<ApiResponse<CompetitionEdition>>(`/admin/editions/${id}`, payload),
    adminDeleteEdition: (id: string) => client.delete<void>(`/admin/editions/${id}`),
    adminSetEditionStatus: (id: string, sharingStatus: CompetitionEdition['sharingStatus']) =>
      client.put<ApiResponse<CompetitionEdition>>(`/admin/editions/${id}/status`, {
        sharingStatus,
      }),
    adminListParticipations: (editionId: string) =>
      client.get<ApiResponse<Participation[]>>(`/admin/editions/${editionId}/participations`),
    adminCreateParticipation: (editionId: string, payload: unknown) =>
      client.post<ApiResponse<Participation>>(
        `/admin/editions/${editionId}/participations`,
        payload,
      ),
    adminUpdateParticipation: (participationId: string, payload: unknown) =>
      client.put<ApiResponse<Participation>>(`/admin/participations/${participationId}`, payload),
    adminDeleteParticipation: (participationId: string) =>
      client.delete<void>(`/admin/participations/${participationId}`),
    adminCreateTemplate: (editionId: string, payload: unknown) =>
      client.post<ApiResponse<SubmissionTemplate>>(
        `/admin/editions/${editionId}/templates`,
        payload,
      ),
    adminUpdateTemplate: (templateId: string, payload: unknown) =>
      client.put<ApiResponse<SubmissionTemplate>>(`/admin/templates/${templateId}`, payload),
    adminDeleteTemplate: (templateId: string) =>
      client.delete<void>(`/admin/templates/${templateId}`),
    adminCopyTemplates: (editionId: string, sourceEditionId: string) =>
      client.post<ApiResponse<SubmissionTemplate[]>>(
        `/admin/editions/${editionId}/templates/copy-from/${sourceEditionId}`,
      ),
    adminListUniversities: () =>
      client.get<ApiResponse<Array<{ id: string; name: string; slug: string }>>>(
        '/admin/universities',
      ),
    adminCreateUniversity: (payload: unknown) =>
      client.post<ApiResponse<{ id: string; name: string; slug: string }>>(
        '/admin/universities',
        payload,
      ),
  };
};
