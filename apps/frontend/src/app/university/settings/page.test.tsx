import { renderWithAuth } from '@/test/test-utils';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UniversitySettingsPage from './page';

describe('/university/settings', () => {
  it('owner以外は拒否される', () => {
    renderWithAuth(<UniversitySettingsPage />, { role: 'member' });
    expect(screen.getByText('この画面へのアクセス権限がありません。')).toBeInTheDocument();
  });

  it('ownerはメンバー操作UIを表示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'm1',
              userId: 'u1',
              role: 'member',
              name: 'A',
              email: 'a@example.com',
            },
          ],
        }),
      }),
    );

    renderWithAuth(<UniversitySettingsPage />, { role: 'owner' });

    expect(await screen.findByText('A (member)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '招待送信' })).toBeInTheDocument();
  });
});
