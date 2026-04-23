'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRegisterForm } from '@/features/public/auth/register/hooks';
import { appendCallbackUrl, normalizeCallbackUrl } from '@/lib/auth/callback-url';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackUrl = normalizeCallbackUrl(rawCallbackUrl);
  const hasCallbackUrl = rawCallbackUrl !== null;
  const loginHref = hasCallbackUrl ? appendCallbackUrl('/auth/login', callbackUrl) : '/auth/login';
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const { form, error, validators } = useRegisterForm(
    (email) => {
      setRegisteredEmail(email);
    },
    hasCallbackUrl ? callbackUrl : undefined,
  );

  if (registeredEmail) {
    return (
      <div className='container mx-auto px-4 py-16 flex justify-center'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>確認メールを送信しました</CardTitle>
            <CardDescription>{registeredEmail} に確認リンクを送信しました</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              メール内のリンクを開くとアカウント作成が完了します。
            </p>
            <Button type='button' className='w-full' onClick={() => router.push(loginHref)}>
              ログインへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <form.Field name='name' validators={{ onChange: validators.name }}>
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
                    <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name='email' validators={{ onChange: validators.email }}>
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
                    <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name='password' validators={{ onChange: validators.password }}>
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
                    <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field
              name='confirmPassword'
              validators={{
                onChangeListenTo: ['password'],
                onChange: ({ value, fieldApi }) => {
                  return validators.confirmPassword({
                    value,
                    password: fieldApi.form.getFieldValue('password'),
                  });
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
                    <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
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
            <Link href={loginHref} className='text-primary hover:underline'>
              ログイン
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
