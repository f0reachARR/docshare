export type SubmissionDenyReason = 'context_required' | 'access_denied';

const denyReasonLabels: Record<SubmissionDenyReason, string> = {
  context_required: '資料種別または所属大学を指定して閲覧してください',
  access_denied: '権限不足のため閲覧できません',
};

const isSubmissionDenyReason = (reason: unknown): reason is SubmissionDenyReason => {
  return reason === 'context_required' || reason === 'access_denied';
};

export const getDenyReasonLabel = (reason: unknown, fallback: string): string => {
  if (isSubmissionDenyReason(reason)) {
    return denyReasonLabels[reason];
  }
  return fallback;
};

export const getSubmissionDenyReasonLabel = ({
  submitted,
  viewable,
  denyReason,
}: {
  submitted: boolean;
  viewable: boolean;
  denyReason: unknown;
}): string | null => {
  if (!submitted || viewable) {
    return null;
  }

  return getDenyReasonLabel(denyReason, denyReasonLabels.access_denied);
};
