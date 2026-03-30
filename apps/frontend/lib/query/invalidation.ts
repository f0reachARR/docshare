import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export async function invalidateAdminSeriesQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.seriesPrefix() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.series.prefix() }),
  ]);
}

export async function invalidateAdminEditionsQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.editionsPrefix() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.editions.prefix() }),
  ]);
}

export async function invalidateAdminTemplatesQueries(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.admin.templatesPrefix(editionId) });
}

export async function invalidateAdminParticipationsQueries(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.admin.participationsPrefix(editionId),
  });
}

export async function invalidateAdminUsersQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.admin.usersPrefix() });
}

export async function invalidateAdminUniversitiesQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.admin.universitiesPrefix() });
}

export async function invalidateUniversityRequestQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.requests.universityPrefix() });
}

export async function invalidateParticipationRequestQueries(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.requests.participationPrefix() });
}

export async function invalidateAdminUniversityRequestQueries(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.admin.universityRequestsPrefix() });
}

export async function invalidateAdminParticipationRequestQueries(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.admin.participationRequestsPrefix() });
}

export async function invalidateUniversityMembersQueries(
  queryClient: QueryClient,
  orgId: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.university.membersPrefix(orgId) });
}

export async function invalidateParticipationCommentsQueries(
  queryClient: QueryClient,
  participationId: string,
  orgId: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.participations.comments(participationId, orgId, {}),
  });
}

export async function invalidateSubmissionStatusQueries(
  queryClient: QueryClient,
  editionId: string,
  participationId: string,
  orgId: string,
  submissionId?: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.editions.mySubmissionStatus(editionId, orgId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.editions.submissionMatrixPrefix(editionId, orgId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.participations.submissionsPrefix(participationId, orgId),
    }),
    submissionId
      ? queryClient.invalidateQueries({
          queryKey: queryKeys.submissions.historyPrefix(submissionId, orgId),
        })
      : Promise.resolve(),
  ]);
}
