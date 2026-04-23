'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAccountSettingsForms } from '@/features/account/settings/hooks';

export default function AccountSettingsPage() {
  const {
    user,
    currentOrganization,
    profileForm,
    passwordForm,
    updateProfileMutation,
    changePasswordMutation,
    validators,
  } = useAccountSettingsForms();

  return (
    <div className='space-y-8 max-w-xl'>
      <h1 className='text-2xl font-bold'>アカウント設定</h1>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>プロフィール</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              profileForm.handleSubmit();
            }}
            className='space-y-4'
          >
            <div className='text-sm text-muted-foreground'>メールアドレス: {user?.email}</div>
            <profileForm.Field name='name' validators={{ onChange: validators.profileName }}>
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    名前
                  </label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors[0] && (
                    <p className='text-sm text-destructive'>{field.state.meta.errors[0].message}</p>
                  )}
                </div>
              )}
            </profileForm.Field>
            <Button type='submit' disabled={updateProfileMutation.isPending}>
              保存
            </Button>
          </form>
        </CardContent>
      </Card>

      {currentOrganization && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>所属大学</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <p className='text-sm font-medium'>{currentOrganization.name}</p>
              <p className='text-sm text-muted-foreground'>大学のメンバーと招待を管理できます。</p>
            </div>
            <Button variant='outline' render={<Link href='/university/settings' />}>
              大学設定を開く
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>パスワード変更</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              passwordForm.handleSubmit();
            }}
            className='space-y-4'
          >
            <passwordForm.Field
              name='currentPassword'
              validators={{ onChange: validators.currentPassword }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    現在のパスワード
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
            </passwordForm.Field>
            <passwordForm.Field
              name='newPassword'
              validators={{ onChange: validators.newPassword }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    新しいパスワード
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
            </passwordForm.Field>
            <passwordForm.Field
              name='confirmPassword'
              validators={{
                onChangeListenTo: ['newPassword'],
                onChange: ({ value, fieldApi }) => {
                  return validators.confirmPassword({
                    value,
                    newPassword: fieldApi.form.getFieldValue('newPassword'),
                  });
                },
              }}
            >
              {(field) => (
                <div className='space-y-1'>
                  <label htmlFor={field.name} className='text-sm font-medium'>
                    新しいパスワード（確認）
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
            </passwordForm.Field>
            <Button type='submit' disabled={changePasswordMutation.isPending}>
              パスワードを変更
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
