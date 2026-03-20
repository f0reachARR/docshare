import { renderWithAuth } from '@/test/test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SubmissionHistoryPage from './page';

describe('/editions/:id/submissions/:submissionId/history', () => {
  it('version降順とDLボタン表示', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'h1',
              version: 1,
              fileName: 'v1.pdf',
              url: null,
              createdAt: '2026-01-01',
            },
            {
              id: 'h2',
              version: 3,
              fileName: 'v3.pdf',
              url: null,
              createdAt: '2026-01-03',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { url: 'https://example.com/history-download' },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(
      <SubmissionHistoryPage params={Promise.resolve({ id: 'ed1', submissionId: 's1' })} />,
    );

    expect(await screen.findByText(/v3/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'DL' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'DL' })[0]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/submission-history/h2/download'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/history-download',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });

  it('履歴取得失敗時にエラー表示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'Forbidden' }),
      }),
    );

    renderWithAuth(
      <SubmissionHistoryPage params={Promise.resolve({ id: 'ed1', submissionId: 's1' })} />,
    );

    expect(await screen.findByText('提出履歴の取得に失敗しました。')).toBeInTheDocument();
  });
});
