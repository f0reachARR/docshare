import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth, useInvalidateMe } from '@/contexts/AuthContext';
import { authClient } from '@/lib/auth/client';

export function useAccountSettingsForms() {
  const { user, organizations, activeOrganizationId } = useAuth();
  const invalidateMe = useInvalidateMe();
  const currentOrganization =
    organizations.find((org) => org.id === activeOrganizationId) ?? organizations[0] ?? null;

  const updateProfileMutation = useMutation({
    mutationFn: async (values: { name: string }) => {
      const result = await authClient.updateUser({ name: values.name });
      if (result.error) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: async () => {
      await invalidateMe();
      toast.success('プロフィールを更新しました');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '更新に失敗しました'),
  });

  const profileForm = useForm({
    defaultValues: { name: user?.name ?? '' },
    onSubmit: async ({ value }) => {
      await updateProfileMutation.mutateAsync(value);
    },
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
      if (result.error) {
        throw new Error(result.error.message);
      }
    },
    onSuccess: () => {
      passwordForm.reset();
      toast.success('パスワードを変更しました');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'パスワード変更に失敗しました'),
  });

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      await changePasswordMutation.mutateAsync(value);
    },
  });

  return {
    user,
    currentOrganization,
    profileForm,
    passwordForm,
    updateProfileMutation,
    changePasswordMutation,
    validators: {
      profileName: z.string().min(1, '名前を入力してください'),
      currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
      newPassword: z.string().min(8, '新しいパスワードは8文字以上で入力してください'),
      confirmPassword: ({ value, newPassword }: { value: string; newPassword: string }) => {
        if (value !== newPassword) {
          return { message: 'パスワードが一致しません' };
        }

        return undefined;
      },
    },
  };
}
