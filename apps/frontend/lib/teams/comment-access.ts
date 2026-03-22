type TeamCommentAccessReason =
  | 'template_required'
  | 'template_not_viewable'
  | 'template_access_unknown';

const reasonLabels: Record<TeamCommentAccessReason, string> = {
  template_required: '資料種別の指定が必要です',
  template_not_viewable: 'この資料種別は閲覧権限がないためコメントできません',
  template_access_unknown: '資料種別の閲覧可否を確認できないためコメントできません',
};

export type TeamCommentAccessState = {
  canShowComments: boolean;
  canPostComments: boolean;
  reason: string | null;
};

export const resolveTeamCommentAccessState = (params: {
  hasTemplateContext: boolean;
  isTemplateViewable: boolean;
  denyReasonLabel?: string | null;
  hasTemplateAccessError?: boolean;
}): TeamCommentAccessState => {
  if (!params.hasTemplateContext) {
    return {
      canShowComments: false,
      canPostComments: false,
      reason: reasonLabels.template_required,
    };
  }

  if (params.isTemplateViewable) {
    return {
      canShowComments: true,
      canPostComments: true,
      reason: null,
    };
  }

  if (params.hasTemplateAccessError) {
    return {
      canShowComments: false,
      canPostComments: false,
      reason: params.denyReasonLabel ?? reasonLabels.template_access_unknown,
    };
  }

  return {
    canShowComments: false,
    canPostComments: false,
    reason: reasonLabels.template_not_viewable,
  };
};
