type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;

  code: string;

  details?: unknown;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code ?? 'UNKNOWN_ERROR';
    this.details = params.details;
  }
}

export type ApiClientConfig = {
  baseUrl: string;
  getOrganizationId: () => string | null;
};

const toApiError = async (response: Response): Promise<ApiError> => {
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  const rawError =
    typeof parsed === 'object' &&
    parsed !== null &&
    'error' in parsed &&
    typeof parsed.error === 'string'
      ? parsed.error
      : undefined;

  return new ApiError({
    status: response.status,
    code: rawError ?? `HTTP_${response.status}`,
    message: rawError ?? response.statusText ?? 'API request failed',
    details: parsed,
  });
};

export const createApiClient = (config: ApiClientConfig) => {
  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const organizationId = config.getOrganizationId();

    const headers: Record<string, string> = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    };

    if (organizationId) {
      headers['X-Organization-Id'] = organizationId;
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  };

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
};
