import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

const Probe = () => {
  const { authState, activeOrganizationId, refresh, setActiveOrganizationId } = useAuth();
  return (
    <div>
      <p data-testid='state'>{authState}</p>
      <p data-testid='org'>{activeOrganizationId ?? 'none'}</p>
      <button type='button' onClick={() => void refresh()}>
        refresh
      </button>
      <button type='button' onClick={() => setActiveOrganizationId('org-2')}>
        set-org
      </button>
    </div>
  );
};

describe('AuthProvider', () => {
  it('未認証状態の初期値を持つ', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('state')).toHaveTextContent('loading');
    expect(screen.getByTestId('org')).toHaveTextContent('none');
  });

  it('認証済み状態へ遷移できる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              id: 'u1',
              email: 'u1@test.dev',
              name: 'u1',
              isAdmin: false,
            },
            organizations: [{ id: 'org-1', name: 'Org 1', slug: 'org-1', role: 'owner' }],
            activeOrganizationId: 'org-1',
          },
        }),
      }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'refresh' }).click();
    });

    expect(screen.getByTestId('state')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('org')).toHaveTextContent('org-1');
  });

  it('active organization切替時に状態へ反映される', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'set-org' }).click();
    });

    expect(screen.getByTestId('org')).toHaveTextContent('org-2');
  });
});
