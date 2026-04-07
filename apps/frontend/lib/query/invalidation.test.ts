import { describe, expect, it, vi } from 'vitest';
import {
  invalidateOrganizationSwitchQueries,
  invalidateSubmissionStatusQueries,
  invalidateUniversityMembersQueries,
} from './invalidation';
import { queryKeys } from './keys';

function createQueryClientMock() {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  };
}

describe('query invalidation helpers', () => {
  it('invalidates university members by membersPrefix', async () => {
    const queryClient = createQueryClientMock();

    await invalidateUniversityMembersQueries(queryClient as never, 'org-1');

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.university.membersPrefix('org-1'),
    });
  });

  it('invalidates submission history by historyPrefix when submissionId exists', async () => {
    const queryClient = createQueryClientMock();

    await invalidateSubmissionStatusQueries(
      queryClient as never,
      'edition-1',
      'participation-1',
      'org-1',
      'submission-1',
    );

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.submissions.historyPrefix('submission-1', 'org-1'),
    });
  });

  it('does not invalidate submission history when submissionId is missing', async () => {
    const queryClient = createQueryClientMock();

    await invalidateSubmissionStatusQueries(
      queryClient as never,
      'edition-1',
      'participation-1',
      'org-1',
    );

    expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.submissions.historyPrefix('submission-1', 'org-1'),
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3);
  });

  it('org切替時にmeと前後org関連のクエリを再取得する', async () => {
    const queryClient = createQueryClientMock();

    await invalidateOrganizationSwitchQueries(queryClient as never, 'org-1', 'org-2');

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.me,
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      predicate: expect.any(Function),
    });

    const predicate = queryClient.invalidateQueries.mock.calls[1][0].predicate as (query: {
      queryKey: ReadonlyArray<unknown>;
    }) => boolean;

    expect(predicate({ queryKey: ['editions', 'x', 'my-submissions', 'org-1', {}] })).toBe(true);
    expect(predicate({ queryKey: ['participations', 'p1', 'org-2'] })).toBe(true);
    expect(predicate({ queryKey: ['series', {}] })).toBe(false);
  });
  it('previousOrganizationId が null のとき org ID を含まないクエリは再取得しない', async () => {
    const queryClient = createQueryClientMock();

    await invalidateOrganizationSwitchQueries(queryClient as never, null, 'org-2');

    const predicate = queryClient.invalidateQueries.mock.calls[1][0].predicate as (query: {
      queryKey: ReadonlyArray<unknown>;
    }) => boolean;

    expect(predicate({ queryKey: ['editions', { page: 1 }] })).toBe(false);
  });
});
