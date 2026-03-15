import { describe, expect, it } from 'vitest';
import {
  isContentTypeConsistent,
  isSubmissionMutableStatus,
  validateSubmissionPayload,
} from './submission-validation.js';

describe('submission validation', () => {
  it('accepts valid file submission payload', () => {
    const result = validateSubmissionPayload(
      {
        acceptType: 'file',
        allowedExtensions: ['pdf'],
        maxFileSizeMb: 100,
        urlPattern: null,
      },
      {
        s3Key: 'submissions/a/b/c/v1_x_file.pdf',
        fileName: 'file.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
      },
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects url when template is file', () => {
    const result = validateSubmissionPayload(
      {
        acceptType: 'file',
        allowedExtensions: ['pdf'],
        maxFileSizeMb: 100,
        urlPattern: null,
      },
      {
        url: 'https://youtu.be/example',
      },
    );

    expect(result.ok).toBe(false);
  });

  it('rejects oversized file', () => {
    const result = validateSubmissionPayload(
      {
        acceptType: 'file',
        allowedExtensions: ['pdf'],
        maxFileSizeMb: 1,
        urlPattern: null,
      },
      {
        s3Key: 'submissions/a/b/c/v1_x_file.pdf',
        fileName: 'file.pdf',
        fileSizeBytes: 2 * 1024 * 1024,
        mimeType: 'application/pdf',
      },
    );

    expect(result).toEqual({
      ok: false,
      error: 'File exceeds template max size',
    });
  });

  it('accepts url that matches host pattern', () => {
    const result = validateSubmissionPayload(
      {
        acceptType: 'url',
        allowedExtensions: null,
        maxFileSizeMb: 100,
        urlPattern: 'youtube.com, youtu.be',
      },
      {
        url: 'https://www.youtube.com/watch?v=abc',
      },
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects url outside pattern', () => {
    const result = validateSubmissionPayload(
      {
        acceptType: 'url',
        allowedExtensions: null,
        maxFileSizeMb: 100,
        urlPattern: 'youtube.com, youtu.be',
      },
      {
        url: 'https://example.com/video',
      },
    );

    expect(result).toEqual({
      ok: false,
      error: 'URL does not match template urlPattern',
    });
  });
});

describe('submission lifecycle status', () => {
  it('allows mutable statuses only in accepting/sharing', () => {
    expect(isSubmissionMutableStatus('draft')).toBe(false);
    expect(isSubmissionMutableStatus('accepting')).toBe(true);
    expect(isSubmissionMutableStatus('sharing')).toBe(true);
    expect(isSubmissionMutableStatus('closed')).toBe(false);
  });
});

describe('upload contentType consistency', () => {
  it('validates known extension/mime pairs', () => {
    expect(isContentTypeConsistent('plan.pdf', 'application/pdf')).toBe(true);
    expect(isContentTypeConsistent('plan.pdf', 'text/plain')).toBe(false);
  });

  it('allows unknown extensions', () => {
    expect(isContentTypeConsistent('archive.7z', 'application/octet-stream')).toBe(true);
  });
});
