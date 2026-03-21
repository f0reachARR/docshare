import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export const apiClient = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  credentials: 'include',
});

// Middleware to inject X-Organization-Id header
export function createOrgMiddleware(organizationId: string | null | undefined): Middleware {
  return {
    onRequest({ request }) {
      if (organizationId) {
        request.headers.set('X-Organization-Id', organizationId);
      }
      return request;
    },
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API Error ${status}`);
    this.name = 'ApiError';
  }
}

// Helper to throw ApiError from openapi-fetch error responses
export function throwIfError<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error);
  }
  return result.data as T;
}
