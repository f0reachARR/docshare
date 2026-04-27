import { describe, expect, it, vi } from 'vitest';
import { buildRuleKey, buildVersionedSubmissionKey, getObjectMetadata } from './storage.js';

describe('storage key builders', () => {
  it('builds versioned submission key with v prefix', () => {
    const key = buildVersionedSubmissionKey({
      editionId: 'edition-1',
      participationId: 'part-1',
      templateId: 'tpl-1',
      version: 3,
      fileName: 'my file.pdf',
    });

    expect(key).toContain('submissions/edition-1/part-1/tpl-1/v3_');
    expect(key.endsWith('_my_file.pdf')).toBe(true);
  });

  it('builds rule key', () => {
    const key = buildRuleKey('ed-1', 'rule doc.pdf');
    expect(key).toContain('rules/ed-1/');
    expect(key.endsWith('_rule_doc.pdf')).toBe(true);
  });

  it('retries metadata lookup until the object becomes visible', async () => {
    const fetchMetadata = vi
      .fn<
        (
          bucket: string,
          key: string,
        ) => Promise<{ contentLength: number | null; contentType: string | null }>
      >()
      .mockRejectedValueOnce(
        Object.assign(new Error('Not found yet'), {
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        }),
      )
      .mockResolvedValueOnce({
        contentLength: 1024,
        contentType: null,
      })
      .mockResolvedValueOnce({
        contentLength: 1024,
        contentType: 'application/pdf',
      });
    const sleep = vi.fn(async (_ms: number) => {});

    const metadata = await getObjectMetadata('bucket', 'key', {
      maxAttempts: 3,
      retryDelayMs: 10,
      fetchMetadata,
      sleep,
    });

    expect(metadata).toEqual({
      contentLength: 1024,
      contentType: 'application/pdf',
    });
    expect(fetchMetadata).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable metadata lookup errors', async () => {
    const fetchMetadata = vi
      .fn<
        (
          bucket: string,
          key: string,
        ) => Promise<{ contentLength: number | null; contentType: string | null }>
      >()
      .mockRejectedValueOnce(new Error('Access denied'));
    const sleep = vi.fn(async (_ms: number) => {});

    await expect(
      getObjectMetadata('bucket', 'key', {
        maxAttempts: 3,
        retryDelayMs: 10,
        fetchMetadata,
        sleep,
      }),
    ).rejects.toThrow('Access denied');

    expect(fetchMetadata).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
