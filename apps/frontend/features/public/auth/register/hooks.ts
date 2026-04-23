import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';

export function useRegisterForm(
  onSuccess: (email: string) => void,
  verificationCallbackUrl?: string,
) {
  const invalidateMe = useInvalidateMe();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        callbackURL: verificationCallbackUrl
          ? new URL(verificationCallbackUrl, window.location.origin).toString()
          : `${window.location.origin}/auth/verify-email`,
      });

      if (result.error) {
        setError(result.error.message ?? 'アカウント作成に失敗しました');
        return;
      }

      if (result.data?.token) {
        await invalidateMe();
      }
      onSuccess(value.email);
    },
  });

  return {
    form,
    error,
    validators: {
      name: z.string().min(1, '名前を入力してください'),
      email: z.string().email('有効なメールアドレスを入力してください'),
      password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
      confirmPassword: ({ value, password }: { value: string; password: string }) => {
        if (value !== password) {
          return { message: 'パスワードが一致しません' };
        }

        return undefined;
      },
    },
  };
}
