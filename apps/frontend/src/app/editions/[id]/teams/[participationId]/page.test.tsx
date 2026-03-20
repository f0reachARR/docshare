import { renderWithAuth } from '@/test/test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamDetailPage from './page';

describe('/editions/:id/teams/:participationId', () => {
  it('コメント投稿/編集/削除とMarkdown表示', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('edited **markdown**');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              submission: {
                id: 's1',
                fileName: 'doc.pdf',
                url: null,
                version: 1,
              },
              participation: { id: 'p1' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'c1',
              participationId: 'p1',
              editionId: 'ed1',
              body: '[link](https://example.com)',
              author: { id: 'user-1', name: 'me', universityName: 'u' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ data: { id: 'c2' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'c1' } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(
      <TeamDetailPage params={Promise.resolve({ id: 'ed1', participationId: 'p1' })} />,
    );

    expect(await screen.findByRole('link', { name: 'link' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('comment-input'), {
      target: { value: 'new comment' },
    });
    fireEvent.click(screen.getByRole('button', { name: '投稿' }));

    fireEvent.click(screen.getByRole('button', { name: '編集' }));
    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/comments/c1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('最新版DLと履歴（過去版DL）導線を表示し、DLで署名URLを開く', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              submission: {
                id: 's1',
                fileName: 'doc.pdf',
                url: null,
                version: 2,
              },
              participation: { id: 'p1' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { url: 'https://example.com/download' } }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(
      <TeamDetailPage params={Promise.resolve({ id: 'ed1', participationId: 'p1' })} />,
    );

    expect(await screen.findByRole('button', { name: '最新版DL' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '履歴（過去版DL）' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '最新版DL' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/submissions/s1/download'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(openSpy).toHaveBeenCalledWith(
        'https://example.com/download',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });
});
