import { ApiError } from '../api/client';

const forbiddenReasonMessages: Record<string, string> = {
  organization_context_required: '所属大学のコンテキストが未選択です',
  sharing_status_not_viewable: '現在は他校資料の共有期間外です',
  organization_not_participating: '選択中の大学はこの大会回に出場登録されていません',
  template_not_submitted: '選択中の大学がこの資料種別を提出していないため閲覧できません',
  template_context_required: '資料種別の指定が必要です',
  participation_not_found: '対象チームが見つかりません',
};

function getForbiddenReasonMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const reason = (body as { reason?: unknown }).reason;
  if (typeof reason !== 'string') {
    return null;
  }

  return forbiddenReasonMessages[reason] ?? null;
}

export function getApiErrorMessage(error: unknown, context?: string): string {
  if (!(error instanceof ApiError)) {
    return '予期しないエラーが発生しました';
  }

  if (error.status === 401) return 'ログインが必要です';
  if (error.status === 403) {
    return getForbiddenReasonMessage(error.body) ?? '権限不足のため操作できません';
  }
  if (error.status === 404) return '対象が見つかりません';

  if (error.status === 409) {
    if (context === 'submission') return '提出受付期間外です';
    if (context === 'last-owner') return '最後のオーナーは変更または削除できません';
    if (context === 'duplicate') return 'すでに登録済みです';
    const body = error.body as Record<string, unknown> | null;
    if (typeof body?.error === 'string') return body.error;
    return '状態の競合が発生しました';
  }

  if (error.status >= 500) return 'サーバーエラーが発生しました。しばらくしてからお試しください';

  return 'エラーが発生しました';
}
