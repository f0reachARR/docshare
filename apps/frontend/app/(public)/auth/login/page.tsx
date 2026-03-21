'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';
import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
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
      router.push(callbackUrl);
    },
  });

  return (
    <div className='container mx-auto px-4 py-16 flex justify-center'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>ログイン</CardTitle>
          <CardDescription>メールアドレスとパスワードでログインします</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className='space-y-4'
          >
            <form.Field
              name='email'
              validators={{ onChange: z.string().email('有効なメールアドレスを入力してください') }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    メールアドレス
                  </label>
                  <Input
                    id={field.name}
                    type='email'
                    placeholder='you@example.com'
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors[0] && (
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field
              name='password'
              validators={{ onChange: z.string().min(1, 'パスワードを入力してください') }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    パスワード
                  </label>
                  <Input
                    id={field.name}
                    type='password'
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors[0] && (
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </form.Field>
            {error && <p className='text-sm text-destructive'>{error}</p>}
            <Button type='submit' className='w-full' disabled={form.state.isSubmitting}>
              {form.state.isSubmitting ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
          <p className='text-sm text-center text-muted-foreground mt-4'>
            アカウントをお持ちでない方は{' '}
            <Link href='/auth/register' className='text-primary hover:underline'>
              新規登録
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
