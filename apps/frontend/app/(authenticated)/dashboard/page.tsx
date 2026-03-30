'use client';

import Link from 'next/link';
import { DateTimeDisplay } from '@/components/common/DateTimeDisplay';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardData } from '@/features/dashboard/query';
import { useUniversityRequestsSection } from '@/features/requests/hooks';
import { REQUEST_STATUS_LABELS } from '@/lib/utils/status';

export default function DashboardPage() {
  const { organizationId, currentOrg, myEditions, isLoading } = useDashboardData();
  const {
    data: universityRequests,
    form,
    createMutation,
    validators,
  } = useUniversityRequestsSection();

  if (!organizationId && !isLoading) {
    return (
      <div className='space-y-6 max-w-3xl'>
        <h1 className='text-2xl font-bold'>ダッシュボード</h1>
        <EmptyState
          title='大学に所属していません'
          description='招待リンクがない場合は、大学追加依頼を送信できます。'
        />
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>大学追加依頼</CardTitle>
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
                name='universityName'
                validators={{ onChange: validators.universityName }}
              >
                {(field) => (
                  <div className='space-y-1'>
                    <label htmlFor={field.name} className='text-sm font-medium'>
                      大学名
                    </label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors[0] && (
                      <p className='text-sm text-destructive'>
                        {field.state.meta.errors[0].message}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <form.Field
                name='representativeEmail'
                validators={{ onChange: validators.representativeEmail }}
              >
                {(field) => (
                  <div className='space-y-1'>
                    <label htmlFor={field.name} className='text-sm font-medium'>
                      代表メールアドレス
                    </label>
                    <Input
                      id={field.name}
                      type='email'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors[0] && (
                      <p className='text-sm text-destructive'>
                        {field.state.meta.errors[0].message}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <form.Field name='message' validators={{ onChange: validators.message }}>
                {(field) => (
                  <div className='space-y-1'>
                    <label htmlFor={field.name} className='text-sm font-medium'>
                      メッセージ
                    </label>
                    <Textarea
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors[0] && (
                      <p className='text-sm text-destructive'>
                        {field.state.meta.errors[0].message}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>
              <div className='flex justify-end'>
                <Button type='submit' disabled={createMutation.isPending}>
                  依頼を送信
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <section className='space-y-3'>
          <h2 className='text-lg font-semibold'>自分の大学追加依頼</h2>
          {universityRequests.length === 0 ? (
            <Card>
              <CardContent className='py-6 text-sm text-muted-foreground'>
                まだ依頼はありません。
              </CardContent>
            </Card>
          ) : (
            universityRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className='py-4 space-y-2'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='font-medium'>{request.universityName}</div>
                    <Badge variant={request.status === 'rejected' ? 'destructive' : 'secondary'}>
                      {REQUEST_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                  </div>
                  <p className='text-sm text-muted-foreground'>{request.representativeEmail}</p>
                  <p className='text-sm'>{request.message}</p>
                  <p className='text-xs text-muted-foreground'>
                    申請日時: <DateTimeDisplay value={request.createdAt} />
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold'>ダッシュボード</h1>
        {currentOrg && <p className='text-muted-foreground mt-1'>{currentOrg.name}</p>}
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
