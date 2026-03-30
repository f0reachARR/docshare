// TanStack Query key factories
// Organization-scoped keys include orgId for proper cache invalidation on org switch

export const queryKeys = {
  me: ['me'] as const,

  series: {
    prefix: () => ['series'] as const,
    all: (params: Record<string, unknown>) => ['series', params] as const,
    allForSelection: () => ['series', { pageSize: 100 }] as const,
    detail: (id: string) => ['series', id] as const,
  },

  editions: {
    prefix: () => ['editions'] as const,
    all: (params: Record<string, unknown>) => ['editions', params] as const,
    allForSelection: () => ['editions', { pageSize: 100 }] as const,
    detail: (id: string) => ['editions', id] as const,
    templates: (id: string, params: Record<string, unknown>) =>
      ['editions', id, 'templates', params] as const,
    myParticipations: (id: string, orgId: string) =>
      ['editions', id, 'my-participations', orgId] as const,
    mySubmissions: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['editions', id, 'my-submissions', orgId, params] as const,
    mySubmissionStatus: (id: string, orgId: string) =>
      ['editions', id, 'my-submission-status', orgId] as const,
    submissionMatrixPrefix: (id: string, orgId: string) =>
      ['editions', id, 'submission-matrix', orgId] as const,
    submissions: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['editions', id, 'submissions', orgId, params] as const,
    submissionMatrix: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['editions', id, 'submission-matrix', orgId, params] as const,
  },

  participations: {
    prefix: (id: string, orgId: string) => ['participations', id, orgId] as const,
    detail: (id: string, orgId: string) => ['participations', id, orgId] as const,
    submissionsPrefix: (id: string, orgId: string) =>
      ['participations', id, 'submissions', orgId] as const,
    submissions: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['participations', id, 'submissions', orgId, params] as const,
    comments: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['participations', id, 'comments', orgId, params] as const,
  },

  submissions: {
    prefix: (id: string) => ['submissions', id] as const,
    historyPrefix: (id: string, orgId: string) => ['submissions', id, 'history', orgId] as const,
    history: (id: string, orgId: string, params: Record<string, unknown>) =>
      [...queryKeys.submissions.historyPrefix(id, orgId), params] as const,
  },

  university: {
    prefix: (orgId: string) => ['university', orgId] as const,
    membersPrefix: (orgId?: string) =>
      orgId ? (['university', 'members', orgId] as const) : (['university', 'members'] as const),
    members: (orgId: string, params: Record<string, unknown>) =>
      [...queryKeys.university.membersPrefix(orgId), params] as const,
  },

  requests: {
    universityPrefix: () => ['requests', 'university'] as const,
    university: () => ['requests', 'university'] as const,
    participationPrefix: () => ['requests', 'participation'] as const,
    participation: () => ['requests', 'participation'] as const,
  },

  admin: {
    seriesPrefix: () => ['admin', 'series'] as const,
    series: (params: Record<string, unknown>) => ['admin', 'series', params] as const,
    editionsPrefix: () => ['admin', 'editions'] as const,
    editions: (params: Record<string, unknown>) => ['admin', 'editions', params] as const,
    participations: (editionId: string, params: Record<string, unknown>) =>
      ['admin', 'editions', editionId, 'participations', params] as const,
    participationsPrefix: (editionId: string) =>
      ['admin', 'editions', editionId, 'participations'] as const,
    templatesPrefix: (editionId: string) => ['admin', 'editions', editionId, 'templates'] as const,
    templates: (editionId: string, params: Record<string, unknown>) =>
      ['admin', 'editions', editionId, 'templates', params] as const,
    universitiesPrefix: () => ['admin', 'universities'] as const,
    universities: (params: Record<string, unknown>) => ['admin', 'universities', params] as const,
    universityRequestsPrefix: () => ['admin', 'university-requests'] as const,
    universityRequests: () => ['admin', 'university-requests'] as const,
    participationRequestsPrefix: () => ['admin', 'participation-requests'] as const,
    participationRequests: () => ['admin', 'participation-requests'] as const,
    usersPrefix: () => ['admin', 'users'] as const,
    users: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
    userMemberships: (userId: string) => ['admin', 'users', userId, 'memberships'] as const,
  },
};
