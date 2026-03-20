import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CompetitionDetailPage from './page';

describe('/competitions/:seriesSlug/:year', () => {
  it('該当大会回を表示する', async () => {
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
            data: [
              {
                id: 'e1',
                seriesId: 's1',
                year: 2024,
                name: 'NHK学生ロボコン2024',
                description: 'desc',
                externalLinks: null,
                ruleDocuments: null,
              },
            ],
          }),
        }),
    );

    render(
      <CompetitionDetailPage
        params={Promise.resolve({
          seriesSlug: 'nhk学生ロボコン',
          year: '2024',
        })}
      />,
    );

    expect(await screen.findByText('NHK学生ロボコン2024')).toBeInTheDocument();
  });

  it('大会未存在時に404相当表示を行う', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        }),
    );

    render(
      <CompetitionDetailPage params={Promise.resolve({ seriesSlug: 'unknown', year: '2024' })} />,
    );

    expect(await screen.findByText('大会が見つかりません。')).toBeInTheDocument();
  });
});
