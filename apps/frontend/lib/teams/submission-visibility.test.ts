import { describe, expect, it } from 'vitest';
import { getDenyReasonLabel, getSubmissionDenyReasonLabel } from './submission-visibility';

describe('submission visibility messaging', () => {
  it('提出済みだが閲覧不可で denyReason=context_required の文言を返す', () => {
    const text = getSubmissionDenyReasonLabel({
      submitted: true,
      viewable: false,
      denyReason: 'context_required',
    });

    expect(text).toBe('資料種別または所属大学を指定して閲覧してください');
  });

  it('提出済みだが閲覧不可で denyReason=access_denied の文言を返す', () => {
    const text = getSubmissionDenyReasonLabel({
      submitted: true,
      viewable: false,
      denyReason: 'access_denied',
    });

    expect(text).toBe('権限不足のため閲覧できません');
  });

  it('提出済みだが閲覧不可で denyReason 不明なら access_denied 相当の文言を返す', () => {
    const text = getSubmissionDenyReasonLabel({
      submitted: true,
      viewable: false,
      denyReason: null,
    });

    expect(text).toBe('権限不足のため閲覧できません');
  });

  it('未提出または閲覧可能なら null を返す', () => {
    expect(
      getSubmissionDenyReasonLabel({
        submitted: false,
        viewable: false,
        denyReason: 'context_required',
      }),
    ).toBeNull();

    expect(
      getSubmissionDenyReasonLabel({
        submitted: true,
        viewable: true,
        denyReason: 'access_denied',
      }),
    ).toBeNull();
  });

  it('公開 reason コード以外はフォールバック文言になる', () => {
    expect(getDenyReasonLabel('organization_context_required', 'fallback')).toBe('fallback');
    expect(getDenyReasonLabel('template_not_submitted', 'fallback')).toBe('fallback');
  });
});
