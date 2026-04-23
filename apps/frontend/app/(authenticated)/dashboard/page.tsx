'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData } from '@/features/dashboard/query';

export default function DashboardPage() {
  const { organizationId, currentOrg, myEditions, isLoading } = useDashboardData();

  if (!organizationId && !isLoading) {
    return (
      <div className='space-y-6 max-w-3xl'>
        <h1 className='text-2xl font-bold'>ダッシュボード</h1>
        <EmptyState
          title='大学に所属していません'
          description='招待リンクがない場合は、大学追加依頼ページから管理者に追加を依頼できます。'
          action={
            <Button render={<Link href='/university/request' />}>大学追加依頼ページへ</Button>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>大学追加依頼</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-sm text-muted-foreground'>
              大学名、代表メールアドレス、メッセージを入力して依頼できます。
            </p>
            <Button variant='outline' render={<Link href='/university/request' />}>
              依頼ページを開く
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold'>ダッシュボード</h1>
          {currentOrg && <p className='text-muted-foreground mt-1'>{currentOrg.name}</p>}
        </div>
        {currentOrg && (
          <Button size='sm' variant='outline' render={<Link href='/university/settings' />}>
            大学設定
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className='grid md:grid-cols-2 gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Skeleton key={i} className='h-40' />
          ))}
        </div>
      ) : myEditions.length === 0 ? (
        <EmptyState
          title='出場登録されている大会がありません'
          description='管理者から出場登録された大会がここに表示されます。'
          action={
            <Button variant='outline' render={<Link href='/competitions' />}>
              大会一覧を見る
            </Button>
          }
        />
      ) : (
        <div className='grid md:grid-cols-2 gap-4'>
          {myEditions.map(({ edition, status }) => {
            const participations = status?.data?.participations ?? [];
            const items = status?.data?.items ?? [];
            const templates = status?.data?.templates ?? [];
            const submittedCount = items.filter((i) => i.submission !== null).length;

            return (
              <Card key={edition.id}>
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-base'>
                      {edition.year}年 {edition.name}
                    </CardTitle>
                    <StatusBadge status={edition.sharingStatus} />
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <p className='text-sm text-muted-foreground'>
                    提出: {submittedCount} / {templates.length} テンプレート
                    {participations.length > 1 && ` (${participations.length}チーム)`}
                  </p>
                  <div className='flex gap-2 flex-wrap'>
                    <Button size='sm' render={<Link href={`/editions/${edition.id}/submit`} />}>
                      資料提出
                    </Button>
                    {(edition.sharingStatus === 'sharing' ||
                      edition.sharingStatus === 'closed') && (
                      <Button
                        size='sm'
                        variant='outline'
                        render={<Link href={`/competitions/${edition.id}`} />}
                      >
                        資料一覧
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
