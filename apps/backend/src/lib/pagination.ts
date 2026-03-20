import { z } from '@hono/zod-openapi';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => {
  return z.object({
    data: z.array(dataSchema),
    pagination: paginationSchema,
  });
};

const createPagingQuerySchemaWithoutQ = <TSortValues extends readonly [string, ...string[]]>(
  sortValues: TSortValues,
) => {
  return z.object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    sort: z
      .string()
      .trim()
      .min(1)
      .optional()
      .openapi({ example: sortValues[0], enum: [...sortValues] }),
  });
};

const createPagingQuerySchemaWithQ = <TSortValues extends readonly [string, ...string[]]>(
  sortValues: TSortValues,
) => {
  return z.object({
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    sort: z
      .string()
      .trim()
      .min(1)
      .optional()
      .openapi({ example: sortValues[0], enum: [...sortValues] }),
    q: z.string().trim().min(1).optional(),
  });
};

export function createPagingQuerySchema<TSortValues extends readonly [string, ...string[]]>(
  sortValues: TSortValues,
  supportsQ: true,
): ReturnType<typeof createPagingQuerySchemaWithQ<TSortValues>>;
export function createPagingQuerySchema<TSortValues extends readonly [string, ...string[]]>(
  sortValues: TSortValues,
  supportsQ: false,
): ReturnType<typeof createPagingQuerySchemaWithoutQ<TSortValues>>;
export function createPagingQuerySchema<TSortValues extends readonly [string, ...string[]]>(
  sortValues: TSortValues,
  supportsQ: boolean,
) {
  if (!supportsQ) {
    return createPagingQuerySchemaWithoutQ(sortValues);
  }

  return createPagingQuerySchemaWithQ(sortValues);
}

type SortValue = `${string}:${'asc' | 'desc'}`;

type ParsePagingParamsInput<TSchema extends z.ZodTypeAny> = {
  query: Record<string, string | undefined>;
  schema: TSchema;
  sortValues: readonly [SortValue, ...SortValue[]];
  defaultSort: SortValue;
};

type ParsedPagingParams = {
  page: number;
  pageSize: number;
  offset: number;
  q: string | undefined;
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
};

export const parsePagingParams = <TSchema extends z.ZodTypeAny>(
  input: ParsePagingParamsInput<TSchema>,
):
  | {
      ok: true;
      value: ParsedPagingParams;
    }
  | {
      ok: false;
      status: 400;
      error: 'Invalid query';
    }
  | {
      ok: false;
      status: 422;
      error: 'Invalid sort';
    } => {
  const parsed = input.schema.safeParse(input.query);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid query',
    };
  }

  const data = parsed.data as {
    page: number;
    pageSize: number;
    sort?: string;
    q?: string;
  };

  const sortRaw = (data.sort ?? input.defaultSort) as SortValue;
  const isAllowedSort = input.sortValues.includes(sortRaw);
  if (!isAllowedSort) {
    return {
      ok: false,
      status: 422,
      error: 'Invalid sort',
    };
  }

  const [field, direction] = sortRaw.split(':') as [string, 'asc' | 'desc'];

  return {
    ok: true,
    value: {
      page: data.page,
      pageSize: data.pageSize,
      offset: (data.page - 1) * data.pageSize,
      q: data.q,
      sort: { field, direction },
    },
  };
};

export const createPaginationMeta = ({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};
