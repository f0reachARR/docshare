// TanStack Query key factories
// Organization-scoped keys include orgId for proper cache invalidation on org switch

export const queryKeys = {
  me: ['me'] as const,

  series: {
    all: (params: Record<string, unknown>) => ['series', params] as const,
    detail: (id: string) => ['series', id] as const,
  },

  editions: {
    all: (params: Record<string, unknown>) => ['editions', params] as const,
    detail: (id: string) => ['editions', id] as const,
    templates: (id: string, params: Record<string, unknown>) =>
      ['editions', id, 'templates', params] as const,
    myParticipations: (id: string, orgId: string) =>
      ['editions', id, 'my-participations', orgId] as const,
    mySubmissions: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['editions', id, 'my-submissions', orgId, params] as const,
    mySubmissionStatus: (id: string, orgId: string) =>
      ['editions', id, 'my-submission-status', orgId] as const,
    submissions: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['editions', id, 'submissions', orgId, params] as const,
  },

  participations: {
    detail: (id: string, orgId: string) => ['participations', id, orgId] as const,
    submissions: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['participations', id, 'submissions', orgId, params] as const,
    comments: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['participations', id, 'comments', orgId, params] as const,
  },

  submissions: {
    history: (id: string, orgId: string, params: Record<string, unknown>) =>
      ['submissions', id, 'history', orgId, params] as const,
  },

  university: {
    members: (orgId: string, params: Record<string, unknown>) =>
      ['university', 'members', orgId, params] as const,
  },

  admin: {
    series: (params: Record<string, unknown>) => ['admin', 'series', params] as const,
    editions: (params: Record<string, unknown>) => ['admin', 'editions', params] as const,
    participations: (editionId: string, params: Record<string, unknown>) =>
      ['admin', 'editions', editionId, 'participations', params] as const,
    templates: (editionId: string, params: Record<string, unknown>) =>
      ['admin', 'editions', editionId, 'templates', params] as const,
    universities: (params: Record<string, unknown>) => ['admin', 'universities', params] as const,
  },
};
