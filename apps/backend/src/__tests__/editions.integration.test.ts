import { beforeEach, describe, expect, it, vi } from 'vitest';

const editionRow = {
  id: '00000000-0000-0000-0000-000000000010',
  seriesId: '00000000-0000-0000-0000-000000000020',
  year: 2026,
  name: 'Robocon 2026',
  description: 'edition description',
  ruleDocuments: [
    {
      label: 'Rulebook',
      s3_key: 'rules/00000000-0000-0000-0000-000000000010/rulebook.pdf',
      mime_type: 'application/pdf',
    },
  ],
  sharingStatus: 'sharing' as const,
  externalLinks: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

const mockCountRows = vi.fn(async () => [{ total: 1 }]);
const mockEditionListRows = vi.fn(async () => [editionRow]);
const mockEditionDetailRows = vi.fn(async () => [editionRow]);
const mockPresignDownload = vi.fn(async (_bucket: string, key: string) => ({
  presignedUrl: `https://files.example.test/${key}`,
  expiresIn: 300,
}));

const mockDb = {
  select: vi.fn((selection?: unknown) => {
    const isCountSelect =
      typeof selection === 'object' && selection !== null && 'total' in selection;

    if (isCountSelect) {
      return {
        from: () => ({
          where: mockCountRows,
        }),
      };
    }

    return {
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: mockEditionListRows,
            }),
          }),
          limit: mockEditionDetailRows,
        }),
        orderBy: () => ({
          limit: () => ({
            offset: mockEditionListRows,
          }),
        }),
      }),
    };
  }),
};

vi.mock('../db/index.js', () => ({ db: mockDb }));

vi.mock('../services/storage.js', () => ({
  buildRuleKey: vi.fn(),
  buildVersionedSubmissionKey: vi.fn(),
  presignDownload: mockPresignDownload,
  presignUpload: vi.fn(),
  presignUploadByKey: vi.fn(),
}));

const { createApp } = await import('../app.js');

describe('editions integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountRows.mockResolvedValue([{ total: 1 }]);
    mockEditionListRows.mockResolvedValue([editionRow]);
    mockEditionDetailRows.mockResolvedValue([editionRow]);
    mockPresignDownload.mockImplementation(async (_bucket: string, key: string) => ({
      presignedUrl: `https://files.example.test/${key}`,
      expiresIn: 300,
    }));
  });

  it('GET /api/editions returns rule document URLs', async () => {
    const app = createApp();

    const res = await app.request(
      `/api/editions?series_id=${editionRow.seriesId}&page=1&pageSize=10&sort=year:asc`,
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: Array<{
        ruleDocuments: Array<{
          label: string;
          mime_type: string;
          s3_key: string;
          url: string;
        }> | null;
      }>;
    };

    expect(json.data[0]?.ruleDocuments?.[0]).toEqual({
      label: 'Rulebook',
      mime_type: 'application/pdf',
      s3_key: editionRow.ruleDocuments[0]?.s3_key,
      url: `https://files.example.test/${editionRow.ruleDocuments[0]?.s3_key}`,
    });
    expect(mockPresignDownload).toHaveBeenCalledWith(
      'robocon-rules',
      editionRow.ruleDocuments[0]?.s3_key,
    );
  });

  it('GET /api/editions/:id returns rule document URLs', async () => {
    const app = createApp();

    const res = await app.request(`/api/editions/${editionRow.id}`);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        ruleDocuments: Array<{
          label: string;
          mime_type: string;
          s3_key: string;
          url: string;
        }> | null;
      };
    };

    expect(json.data.ruleDocuments?.[0]).toEqual({
      label: 'Rulebook',
      mime_type: 'application/pdf',
      s3_key: editionRow.ruleDocuments[0]?.s3_key,
      url: `https://files.example.test/${editionRow.ruleDocuments[0]?.s3_key}`,
    });
  });
});
