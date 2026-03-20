import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CompetitionsPage from './page';

describe('/competitions', () => {
  it('シリーズ一覧取得成功を表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 's1', name: 'NHK学生ロボコン', description: null }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'e1', seriesId: 's1', year: 2024, name: '2024' }],
          }),
        }),
    );

    render(<CompetitionsPage />);

    expect(await screen.findByText('NHK学生ロボコン')).toBeInTheDocument();
  });

  it('取得失敗時に再試行導線を表示する', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server',
        json: async () => ({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<CompetitionsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });
});
