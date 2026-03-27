import { describe, expect, it, vi } from 'vitest';
import {
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
});
