import { apiClient, throwIfError } from '@/lib/api/client';
import { invalidateAdminUniversitiesQueries } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

export type University = {
  id: string;
  name: string;
  slug: string;
  createdAt: unknown;
};

export function useAdminUniversitiesList() {
  return useQuery({
    queryKey: queryKeys.admin.universities({}),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/universities', {
        params: { query: { pageSize: 100 } },
      });
      return throwIfError(result);
    },
  });
}

export function useCreateUniversityForm(onClose: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (values: { name: string; slug: string; ownerEmail: string }) => {
      const result = await apiClient.POST('/api/admin/universities', {
        body: {
          name: values.name,
          slug: values.slug,
          ownerEmail: values.ownerEmail || undefined,
        },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminUniversitiesQueries(queryClient);
      toast.success('大学を作成しました');
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const form = useForm({
    defaultValues: { name: '', slug: '', ownerEmail: '' },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return {
    form,
    mutation,
    validators: {
      name: z.string().min(1, '名称を入力してください'),
      slug: z
        .string()
        .min(1, 'スラッグを入力してください')
        .regex(/^[a-z0-9-]+$/, '半角英数字とハイフンのみ使用できます'),
      ownerEmail: z.string().email('有効なメールアドレスを入力してください').or(z.literal('')),
    },
  };
}
