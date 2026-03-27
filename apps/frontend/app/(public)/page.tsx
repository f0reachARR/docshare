'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRightIcon, EyeIcon, FileTextIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';

export default function TopPage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className='container mx-auto px-4 py-16 space-y-16'>
      {/* Hero */}
      <section className='text-center space-y-6'>
        <h1 className='text-4xl font-bold tracking-tight'>製本企画</h1>
        <p className='text-xl text-muted-foreground max-w-2xl mx-auto'>
          ロボコン参加チームが資料を安全に共有・管理できるプラットフォームです
        </p>
        <div className='flex gap-3 justify-center flex-wrap'>
          {!isLoading &&
            (isAuthenticated ? (
              <Button size='lg' render={<Link href='/dashboard' />}>
                ダッシュボードへ
                <ArrowRightIcon className='ml-2 h-4 w-4' />
              </Button>
            ) : (
              <>
                <Button size='lg' render={<Link href='/auth/login' />}>
                  ログイン
                </Button>
                <Button size='lg' variant='outline' render={<Link href='/auth/register' />}>
                  アカウント作成
                </Button>
              </>
            ))}
          <Button size='lg' variant='outline' render={<Link href='/competitions' />}>
            大会一覧を見る
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className='space-y-6'>
        <h2 className='text-2xl font-semibold text-center'>主な機能</h2>
        <div className='grid md:grid-cols-3 gap-6'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <FileTextIcon className='h-5 w-5' />
                資料提出・管理
              </CardTitle>
            </CardHeader>
            <CardContent className='text-sm text-muted-foreground'>
              大会ごとに定められたテンプレートに従って資料を提出・差し替えできます。
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <UsersIcon className='h-5 w-5' />
                チーム別閲覧
              </CardTitle>
            </CardHeader>
            <CardContent className='text-sm text-muted-foreground'>
              参加チームごとの資料をまとめて閲覧できます。コメント機能でチーム間のコミュニケーションも可能です。
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-base'>
                <EyeIcon className='h-5 w-5' />
                権限管理
              </CardTitle>
            </CardHeader>
            <CardContent className='text-sm text-muted-foreground'>
              共有している資料と同じ資料のみを閲覧できます。ギブアンドテイクの精神で、提出すれば他校の資料も見られるようになります。
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How to use */}
      <section className='space-y-6 max-w-2xl mx-auto'>
        <h2 className='text-2xl font-semibold text-center'>利用の流れ</h2>
        <ol className='space-y-4'>
          {[
            { step: 1, text: '大学の代表者が大学アカウントを作成します' },
            { step: 2, text: 'メンバーを招待してチームに参加してもらいます' },
            { step: 3, text: '大会回に出場登録をして資料を提出します' },
            { step: 4, text: '他校の資料を閲覧し参考にできます' },
          ].map(({ step, text }) => (
            <li key={step} className='flex items-start gap-3'>
              <span className='shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium'>
                {step}
              </span>
              <span className='text-muted-foreground pt-0.5'>{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
