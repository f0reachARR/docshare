'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth, useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';

export default function InvitePage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = use(params);
  const { isAuthenticated, isLoading } = useAuth();
  const invalidateMe = useInvalidateMe();
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inviteCallbackUrl = `/invite/${encodeURIComponent(invitationId)}`;
  const loginHref = `/auth/login?callbackUrl=${encodeURIComponent(inviteCallbackUrl)}`;
  const registerHref = `/auth/register?callbackUrl=${encodeURIComponent(inviteCallbackUrl)}`;

  const handleAccept = async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const result = await authClient.organization.acceptInvitation({ invitationId });
      if (result.error) {
        setStatus('error');
        setErrorMessage(result.error.message ?? '招待の承認に失敗しました');
        return;
      }
      await invalidateMe();
      router.push('/dashboard');
    } catch {
      setStatus('error');
      setErrorMessage('招待の承認に失敗しました。招待が無効または期限切れの可能性があります');
    }
  };

  if (isLoading) {
    return (
      <div className='container mx-auto px-4 py-16 flex justify-center'>
        <Card className='w-full max-w-md'>
          <CardContent className='py-8 text-center text-muted-foreground'>
            読み込み中...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className='container mx-auto px-4 py-16 flex justify-center'>
        <Card className='w-full max-w-md'>
          <CardHeader>
            <CardTitle>招待を承認するにはログインが必要です</CardTitle>
            <CardDescription>ログインまたはアカウントを作成してから承認できます</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-3'>
            <Button render={<Link href={loginHref} />}>ログイン</Button>
            <Button variant='outline' render={<Link href={registerHref} />}>
              アカウントを作成
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
          <CardTitle>大学への招待</CardTitle>
          <CardDescription>招待を承認して大学に参加します</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {errorMessage && <p className='text-sm text-destructive'>{errorMessage}</p>}
          <Button className='w-full' onClick={handleAccept} disabled={status === 'loading'}>
            {status === 'loading' ? '処理中...' : '招待を承認する'}
          </Button>
          <Button variant='outline' className='w-full' render={<Link href='/dashboard' />}>
            キャンセル
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
