import { describe, expect, it } from 'vitest';
import { resolveTeamCommentAccessState } from './comment-access';

describe('resolveTeamCommentAccessState', () => {
  it('template context がない場合はコメント導線を無効化する', () => {
    const state = resolveTeamCommentAccessState({
      hasTemplateContext: false,
      isTemplateViewable: false,
    });

    expect(state).toEqual({
      canShowComments: false,
      canPostComments: false,
      reason: '資料種別の指定が必要です',
    });
  });

  it('template が閲覧可能な場合はコメント導線を有効化する', () => {
    const state = resolveTeamCommentAccessState({
      hasTemplateContext: true,
      isTemplateViewable: true,
    });

    expect(state).toEqual({
      canShowComments: true,
      canPostComments: true,
      reason: null,
    });
  });

  it('template のアクセス判定で拒否理由がある場合は理由付きで無効化する', () => {
    const state = resolveTeamCommentAccessState({
      hasTemplateContext: true,
      isTemplateViewable: false,
      hasTemplateAccessError: true,
      denyReasonLabel: '権限不足のため閲覧できません',
    });

    expect(state).toEqual({
      canShowComments: false,
      canPostComments: false,
      reason: '権限不足のため閲覧できません',
    });
  });

  it('template のアクセス判定失敗時に理由がなければ既定文言を返す', () => {
    const state = resolveTeamCommentAccessState({
      hasTemplateContext: true,
      isTemplateViewable: false,
      hasTemplateAccessError: true,
    });

    expect(state).toEqual({
      canShowComments: false,
      canPostComments: false,
      reason: '資料種別の閲覧可否を確認できないためコメントできません',
    });
  });
});
