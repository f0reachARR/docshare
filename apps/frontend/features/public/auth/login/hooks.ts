import { useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';

export function useLoginForm(onSuccess: () => void) {
  const invalidateMe = useInvalidateMe();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });

      if (result.error) {
        setError('メールアドレスまたはパスワードが正しくありません');
        return;
      }

      await invalidateMe();
      onSuccess();
    },
  });

  return {
    form,
    error,
    validators: {
      email: z.string().email('有効なメールアドレスを入力してください'),
      password: z.string().min(1, 'パスワードを入力してください'),
    },
  };
}
