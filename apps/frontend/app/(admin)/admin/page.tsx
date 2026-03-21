import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

const adminSections = [
  {
    href: '/admin/series',
    title: '大会シリーズ管理',
    description: 'シリーズの作成・編集・削除',
  },
  {
    href: '/admin/editions',
    title: '大会回管理',
    description: '大会回の作成・編集・削除・状態変更・ルール資料',
  },
  {
    href: '/admin/universities',
    title: '大学管理',
    description: '大学の作成・代表者招待',
  },
];

export default function AdminDashboardPage() {
  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-bold'>管理ダッシュボード</h1>
      <div className='grid md:grid-cols-2 gap-4'>
        {adminSections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className='hover:bg-muted/50 transition-colors cursor-pointer'>
              <CardHeader>
                <CardTitle className='text-base'>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
