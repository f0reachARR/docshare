import { FileQuestionIcon, HomeIcon, SearchXIcon, TrophyIcon } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className='flex-1'>
        <div className='container mx-auto min-h-[calc(100svh-3.5rem)] px-4 py-12 flex items-center'>
          <section className='mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1fr_0.9fr]'>
            <div className='space-y-6 text-center md:text-left'>
              <p className='text-sm font-semibold text-primary'>404</p>
              <div className='space-y-3'>
                <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>
                  探している資料が見つかりません
                </h1>
                <p className='mx-auto max-w-2xl text-base leading-7 text-muted-foreground md:mx-0'>
                  URLが変わったか、資料が整理されたか、閲覧できる場所ではないのかもしれません。
                  いったん戻って、必要な資料を探し直してみてください。
                </p>
              </div>

              <div className='flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:justify-start justify-center'>
                <Button size='lg' render={<Link href='/' />}>
                  <HomeIcon className='h-4 w-4' />
                  ホームへ戻る
                </Button>
                <Button size='lg' variant='outline' render={<Link href='/competitions' />}>
                  <TrophyIcon className='h-4 w-4' />
                  大会一覧を見る
                </Button>
              </div>

              <Button variant='link' className='px-0' render={<Link href='/dashboard' />}>
                ダッシュボードを開く
              </Button>
            </div>

            <div className='relative mx-auto aspect-[4/3] w-full max-w-md' aria-hidden='true'>
              <div className='absolute inset-x-8 bottom-6 h-5 rounded-full bg-foreground/10 blur-xl' />

              <div className='absolute left-8 top-12 h-52 w-36 -rotate-6 rounded-lg border bg-card p-4 shadow-md'>
                <div className='mb-4 h-3 w-20 rounded-full bg-muted' />
                <div className='space-y-2'>
                  <div className='h-2 rounded-full bg-muted' />
                  <div className='h-2 w-4/5 rounded-full bg-muted' />
                  <div className='h-2 w-2/3 rounded-full bg-muted' />
                </div>
              </div>

              <div className='absolute right-8 top-16 h-52 w-36 rotate-6 rounded-lg border bg-card p-4 shadow-md'>
                <div className='mb-4 h-3 w-16 rounded-full bg-secondary' />
                <div className='space-y-2'>
                  <div className='h-2 rounded-full bg-muted' />
                  <div className='h-2 w-3/4 rounded-full bg-muted' />
                  <div className='h-2 w-5/6 rounded-full bg-muted' />
                </div>
              </div>

              <div className='absolute inset-x-0 top-8 mx-auto flex h-56 w-40 flex-col items-center justify-center rounded-lg border bg-background p-5 text-center shadow-lg'>
                <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground'>
                  <FileQuestionIcon className='h-8 w-8' />
                </div>
                <div className='space-y-2'>
                  <div className='mx-auto h-2 w-20 rounded-full bg-muted' />
                  <div className='mx-auto h-2 w-14 rounded-full bg-muted' />
                </div>
              </div>

              <div className='absolute bottom-12 right-12 flex h-16 w-16 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md'>
                <SearchXIcon className='h-8 w-8' />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
