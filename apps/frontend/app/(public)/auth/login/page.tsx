'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLoginForm } from '@/features/public/auth/login/hooks';
import { appendCallbackUrl, normalizeCallbackUrl } from '@/lib/auth/callback-url';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams.get('callbackUrl'));
  const registerHref = appendCallbackUrl('/auth/register', callbackUrl);
  const { form, error, validators } = useLoginForm(() => {
    router.push(callbackUrl);
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
            {error && <p className='text-sm text-destructive'>{error}</p>}
            <Button type='submit' className='w-full' disabled={form.state.isSubmitting}>
              {form.state.isSubmitting ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
          <p className='text-sm text-center text-muted-foreground mt-4'>
            <Link href='/auth/forgot-password' className='text-primary hover:underline'>
              パスワードをお忘れの方
            </Link>
          </p>
          <p className='text-sm text-center text-muted-foreground mt-4'>
            アカウントをお持ちでない方は{' '}
            <Link href={registerHref} className='text-primary hover:underline'>
              新規登録
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
