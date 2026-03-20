import { describe, expect, it } from 'vitest';
import { createPaginationMeta, createPagingQuerySchema, parsePagingParams } from './pagination.js';

describe('pagination helper', () => {
  const sortValues = ['createdAt:desc', 'createdAt:asc'] as const;
  const schema = createPagingQuerySchema(sortValues, true);

  it('applies defaults when query is empty', () => {
    const result = parsePagingParams({
      query: {},
      schema,
      sortValues,
      defaultSort: 'createdAt:desc',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.page).toBe(1);
    expect(result.value.pageSize).toBe(20);
    expect(result.value.offset).toBe(0);
    expect(result.value.sort).toEqual({
      field: 'createdAt',
      direction: 'desc',
    });
  });

  it('parses explicit query and sort', () => {
    const result = parsePagingParams({
      query: { page: '2', pageSize: '10', sort: 'createdAt:asc', q: 'abc' },
      schema,
      sortValues,
      defaultSort: 'createdAt:desc',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.page).toBe(2);
    expect(result.value.pageSize).toBe(10);
    expect(result.value.offset).toBe(10);
    expect(result.value.q).toBe('abc');
    expect(result.value.sort).toEqual({ field: 'createdAt', direction: 'asc' });
  });

  it('returns 400 for invalid page/pageSize', () => {
    const result = parsePagingParams({
      query: { page: '0', pageSize: '101' },
      schema,
      sortValues,
      defaultSort: 'createdAt:desc',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(400);
  });

  it('returns 422 for invalid sort', () => {
    const result = parsePagingParams({
      query: { sort: 'name:desc' },
      schema,
      sortValues,
      defaultSort: 'createdAt:desc',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.status).toBe(422);
  });

  it('creates pagination metadata', () => {
    expect(createPaginationMeta({ page: 1, pageSize: 20, total: 0 })).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });

    expect(createPaginationMeta({ page: 2, pageSize: 20, total: 35 })).toEqual({
      page: 2,
      pageSize: 20,
      total: 35,
      totalPages: 2,
      hasNext: false,
      hasPrev: true,
    });
  });
});
