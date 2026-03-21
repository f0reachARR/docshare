'use client';

import { Header } from '@/components/layout/Header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className='p-8 space-y-4'>
        <Skeleton className='h-14 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <Header />
      <main className='flex-1 container mx-auto px-4 py-8'>{children}</main>
    </>
  );
}
