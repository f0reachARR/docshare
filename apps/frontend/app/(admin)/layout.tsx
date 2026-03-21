'use client';

import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const adminNavLinks = [
  { href: '/admin', label: '管理ダッシュボード' },
  { href: '/admin/series', label: '大会シリーズ' },
  { href: '/admin/editions', label: '大会回' },
  { href: '/admin/universities', label: '大学' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || !user.isAdmin)) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className='p-8 space-y-4'>
        <Skeleton className='h-14 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    );
  }

  if (!user?.isAdmin) return null;

  return (
    <>
      <Header />
      <div className='flex flex-1'>
        <aside className='hidden md:block w-48 border-r min-h-full p-4'>
          <nav className='space-y-1'>
            {adminNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className='block text-sm px-3 py-2 rounded hover:bg-muted transition-colors'
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className='flex-1 container px-4 py-8'>{children}</main>
      </div>
    </>
  );
}
