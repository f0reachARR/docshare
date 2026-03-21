'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth, useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

export default function AccountSettingsPage() {
  const { user } = useAuth();
  const invalidateMe = useInvalidateMe();

  const profileForm = useForm({
    defaultValues: { name: user?.name ?? '' },
    onSubmit: async ({ value }) => {
      await updateProfileMutation.mutateAsync(value);
    },
  });

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      await changePasswordMutation.mutateAsync(value);
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values: { name: string }) => {
      const result = await authClient.updateUser({ name: values.name });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      await invalidateMe();
      toast.success('プロフィールを更新しました');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '更新に失敗しました'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (values: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: () => {
      passwordForm.reset();
      toast.success('パスワードを変更しました');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'パスワード変更に失敗しました'),
  });

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
            <profileForm.Field
              name='name'
              validators={{ onChange: z.string().min(1, '名前を入力してください') }}
            >
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
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
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
              validators={{ onChange: z.string().min(1, '現在のパスワードを入力してください') }}
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
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </passwordForm.Field>
            <passwordForm.Field
              name='newPassword'
              validators={{
                onChange: z.string().min(8, '新しいパスワードは8文字以上で入力してください'),
              }}
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
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
                  )}
                </div>
              )}
            </passwordForm.Field>
            <passwordForm.Field
              name='confirmPassword'
              validators={{
                onChangeListenTo: ['newPassword'],
                onChange: ({ value, fieldApi }) => {
                  if (value !== fieldApi.form.getFieldValue('newPassword')) {
                    return 'パスワードが一致しません';
                  }
                  return undefined;
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
                    <p className='text-sm text-destructive'>{String(field.state.meta.errors[0])}</p>
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
