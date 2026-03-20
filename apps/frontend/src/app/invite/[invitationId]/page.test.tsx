import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InvitePage from './page';

describe('/invite/:invitationId', () => {
  it('正常承認', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: true }),
      }),
    );

    render(<InvitePage params={Promise.resolve({ invitationId: 'ok-id' })} />);
    fireEvent.click(await screen.findByRole('button', { name: '招待を承認する' }));

    expect(await screen.findByText('招待を承認しました。')).toBeInTheDocument();
  });

  it('期限切れ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: 'expired' }),
      }),
    );

    render(<InvitePage params={Promise.resolve({ invitationId: 'expired-id' })} />);
    fireEvent.click(await screen.findByRole('button', { name: '招待を承認する' }));

    expect(await screen.findByText('この招待は期限切れです。')).toBeInTheDocument();
  });

  it('不正ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not found',
        json: async () => ({ error: 'invalid' }),
      }),
    );

    render(<InvitePage params={Promise.resolve({ invitationId: 'bad-id' })} />);
    fireEvent.click(await screen.findByRole('button', { name: '招待を承認する' }));

    expect(await screen.findByText('招待IDが不正です。')).toBeInTheDocument();
  });
});
