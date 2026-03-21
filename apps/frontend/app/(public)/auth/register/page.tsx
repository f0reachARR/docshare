'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';
import { useForm } from '@tanstack/react-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';

export default function RegisterPage() {
  const router = useRouter();
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
      });

      if (result.error) {
        setError(result.error.message ?? 'アカウント作成に失敗しました');
        return;
      }

      await invalidateMe();
      router.push('/dashboard');
    },
  });

  return (
    <div className='container mx-auto px-4 py-16 flex justify-center'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>アカウント作成</CardTitle>
          <CardDescription>新しいアカウントを作成します</CardDescription>
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
              name='name'
              validators={{ onChange: z.string().min(1, '名前を入力してください') }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    お名前
                  </label>
                  <Input
                    id={field.name}
                    placeholder='山田 太郎'
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
              validators={{
                onChange: z.string().min(8, 'パスワードは8文字以上で入力してください'),
              }}
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
            <form.Field
              name='confirmPassword'
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }) => {
                  if (value !== fieldApi.form.getFieldValue('password')) {
                    return 'パスワードが一致しません';
                  }
                  return undefined;
                },
              }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    パスワード（確認）
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
              {form.state.isSubmitting ? '作成中...' : 'アカウントを作成'}
            </Button>
          </form>
          <p className='text-sm text-center text-muted-foreground mt-4'>
            すでにアカウントをお持ちの方は{' '}
            <Link href='/auth/login' className='text-primary hover:underline'>
              ログイン
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
