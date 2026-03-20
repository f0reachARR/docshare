import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from './login/page';
import RegisterPage from './register/page';

describe('auth forms', () => {
  it('ログインフォームのバリデーション', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    expect(await screen.findByText('メールアドレスとパスワードは必須です。')).toBeInTheDocument();
  });

  it('登録フォームのバリデーション', async () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText('名前'), {
      target: { value: 'user' },
    });
    fireEvent.change(screen.getByLabelText('メールアドレス'), {
      target: { value: 'invalid' },
    });
    fireEvent.change(screen.getByLabelText('パスワード'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登録' }));

    expect(await screen.findByText('メールアドレス形式が不正です。')).toBeInTheDocument();
  });
});
