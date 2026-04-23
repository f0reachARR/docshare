const DEFAULT_CALLBACK_URL = '/dashboard';

export function normalizeCallbackUrl(callbackUrl: string | null): string {
  if (!callbackUrl) return DEFAULT_CALLBACK_URL;
  if (!callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) {
    return DEFAULT_CALLBACK_URL;
  }

  return callbackUrl;
}

export function appendCallbackUrl(path: string, callbackUrl: string): string {
  const params = new URLSearchParams({ callbackUrl });
  return `${path}?${params.toString()}`;
}
