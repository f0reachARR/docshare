'use client';

import { Button } from '@/components/ui/button';
import { useAuth, useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';
import { LogOutIcon, SettingsIcon, ShieldIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { OrgSwitcher } from './OrgSwitcher';

export function Header() {
  const { isAuthenticated, user } = useAuth();
  const invalidateMe = useInvalidateMe();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await authClient.signOut();
    await invalidateMe();
    router.push('/');
  };

  return (
    <header className='border-b bg-background sticky top-0 z-50'>
      <div className='container mx-auto px-4 h-14 flex items-center justify-between gap-4'>
        <div className='flex items-center gap-6'>
          <Link href='/' className='font-semibold text-base'>
            ロボコン資料共有
          </Link>
          <nav className='hidden md:flex items-center gap-4'>
            <Link
              href='/competitions'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              大会一覧
            </Link>
            {isAuthenticated && (
              <Link
                href='/dashboard'
                className='text-sm text-muted-foreground hover:text-foreground transition-colors'
              >
                ダッシュボード
              </Link>
            )}
          </nav>
        </div>

        <div className='flex items-center gap-2'>
          {isAuthenticated ? (
            <>
              <OrgSwitcher />
              {user?.isAdmin && (
                <Button variant='ghost' size='sm' render={<Link href='/admin' />}>
                  <ShieldIcon className='h-4 w-4' />
                  <span className='hidden md:inline ml-1'>管理</span>
                </Button>
              )}
              <Button variant='ghost' size='sm' render={<Link href='/account/settings' />}>
                <SettingsIcon className='h-4 w-4' />
              </Button>
              <Button variant='ghost' size='sm' onClick={handleSignOut}>
                <LogOutIcon className='h-4 w-4' />
                <span className='hidden md:inline ml-1'>ログアウト</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant='ghost'
                size='sm'
                render={<Link href={`/auth/login?callbackUrl=${encodeURIComponent(pathname)}`} />}
              >
                ログイン
              </Button>
              <Button size='sm' render={<Link href='/auth/register' />}>
                アカウント作成
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
