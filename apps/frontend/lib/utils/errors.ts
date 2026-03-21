import { ApiError } from '../api/client';

export function getApiErrorMessage(error: unknown, context?: string): string {
  if (!(error instanceof ApiError)) {
    return '予期しないエラーが発生しました';
  }

  if (error.status === 401) return 'ログインが必要です';
  if (error.status === 403) return '権限不足のため操作できません';
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
