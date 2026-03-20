import { renderWithAuth } from '@/test/test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminSeriesPage from './page';

describe('/admin/series', () => {
  it('非adminはアクセス拒否', () => {
    renderWithAuth(<AdminSeriesPage />, { role: 'member' });
    expect(screen.getByText('この画面へのアクセス権限がありません。')).toBeInTheDocument();
  });

  it('CRUD成功/失敗表示', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 's1', name: 'A' }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad',
        json: async () => ({ error: 'bad request' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    renderWithAuth(<AdminSeriesPage />, { role: 'admin' });

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'new' },
    });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
