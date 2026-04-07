import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsInteger, useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { z } from 'zod';
import { apiClient, throwIfError } from '@/lib/api/client';
import type { paths } from '@/lib/api/schema';
import {
  invalidateAdminParticipationRequestQueries,
  invalidateAdminParticipationsQueries,
  invalidateAdminUniversitiesQueries,
  invalidateAdminUniversityRequestQueries,
  invalidateParticipationRequestQueries,
  invalidateUniversityRequestQueries,
} from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/keys';
import { getApiErrorMessage } from '@/lib/utils/errors';

export type UniversityRequestStatus =
  paths['/api/university-requests']['get']['responses'][200]['content']['application/json']['data'][number]['status'];

export type ParticipationRequestStatus =
  paths['/api/participation-requests']['get']['responses'][200]['content']['application/json']['data'][number]['status'];

export type UniversityRequest =
  paths['/api/university-requests']['get']['responses'][200]['content']['application/json']['data'][number];

export type ParticipationRequest =
  paths['/api/participation-requests']['get']['responses'][200]['content']['application/json']['data'][number];

type AdminUniversityRequestsResponse =
  paths['/api/admin/university-requests']['get']['responses'][200]['content']['application/json'];
type AdminParticipationRequestsResponse =
  paths['/api/admin/participation-requests']['get']['responses'][200]['content']['application/json'];

type UniversityRequestFormValues = {
  universityName: string;
  representativeEmail: string;
  message: string;
};

type ParticipationRequestFormValues = {
  teamName: string;
  message: string;
};

export function useUniversityRequestsSection() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.requests.university(),
    queryFn: async () => {
      const result = await apiClient.GET('/api/university-requests');
      return throwIfError(result);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: UniversityRequestFormValues) => {
      const result = await apiClient.POST('/api/university-requests', {
        body: values,
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateUniversityRequestQueries(queryClient);
      toast.success('大学追加依頼を送信しました');
      form.reset();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const form = useForm({
    defaultValues: {
      universityName: '',
      representativeEmail: '',
      message: '',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  return {
    data: data?.data ?? [],
    isLoading,
    form,
    createMutation,
    validators: {
      universityName: z.string().min(1, '大学名を入力してください'),
      representativeEmail: z.string().email('有効なメールアドレスを入力してください'),
      message: z.string().min(1, 'メッセージを入力してください'),
    },
  };
}

export function useParticipationRequestsSection(editionId: string, organizationId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.requests.participation(organizationId),
    queryFn: async () => {
      const result = await apiClient.GET('/api/participation-requests', {
        params: {
          header: organizationId ? { 'x-organization-id': organizationId } : {},
        },
      });
      return throwIfError(result);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ParticipationRequestFormValues) => {
      const result = await apiClient.POST('/api/editions/{id}/participation-requests', {
        params: {
          path: { id: editionId },
          header: { 'x-organization-id': organizationId ?? '' },
        },
        body: {
          teamName: values.teamName || undefined,
          message: values.message,
        },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateParticipationRequestQueries(queryClient);
      toast.success('出場追加依頼を送信しました');
      form.reset();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const form = useForm({
    defaultValues: {
      teamName: '',
      message: '',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  return {
    data: (data?.data ?? []).filter((request) => request.edition.id === editionId),
    isLoading,
    form,
    createMutation,
    validators: {
      message: z.string().min(1, 'メッセージを入力してください'),
    },
  };
}

export function useAdminRequestsPage() {
  const queryClient = useQueryClient();
  const [universityQueryParams, setUniversityQueryParams] = useQueryStates({
    universityPage: parseAsInteger.withDefault(1),
    universityPageSize: parseAsInteger.withDefault(20),
  });
  const [participationQueryParams, setParticipationQueryParams] = useQueryStates({
    participationPage: parseAsInteger.withDefault(1),
    participationPageSize: parseAsInteger.withDefault(20),
  });

  const universityRequestsQuery = useQuery({
    queryKey: queryKeys.admin.universityRequests({
      page: universityQueryParams.universityPage,
      pageSize: universityQueryParams.universityPageSize,
    }),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/university-requests', {
        params: {
          query: {
            page: universityQueryParams.universityPage,
            pageSize: universityQueryParams.universityPageSize,
          },
        },
      });
      return throwIfError(result);
    },
  });

  const participationRequestsQuery = useQuery({
    queryKey: queryKeys.admin.participationRequests({
      page: participationQueryParams.participationPage,
      pageSize: participationQueryParams.participationPageSize,
    }),
    queryFn: async () => {
      const result = await apiClient.GET('/api/admin/participation-requests', {
        params: {
          query: {
            page: participationQueryParams.participationPage,
            pageSize: participationQueryParams.participationPageSize,
          },
        },
      });
      return throwIfError(result);
    },
  });

  const approveUniversityMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.POST('/api/admin/university-requests/{id}/approve', {
        params: { path: { id } },
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateAdminUniversityRequestQueries(queryClient),
        invalidateAdminUniversitiesQueries(queryClient),
      ]);
      toast.success('大学追加依頼を承認しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectUniversityMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.POST('/api/admin/university-requests/{id}/reject', {
        params: { path: { id } },
        body: {},
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminUniversityRequestQueries(queryClient);
      toast.success('大学追加依頼を却下しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const approveParticipationMutation = useMutation({
    mutationFn: async (request: ParticipationRequest) => {
      const result = await apiClient.POST('/api/admin/participation-requests/{id}/approve', {
        params: { path: { id: request.id } },
      });
      return { request, response: throwIfError(result) };
    },
    onSuccess: async ({ request }) => {
      await Promise.all([
        invalidateAdminParticipationRequestQueries(queryClient),
        invalidateAdminParticipationsQueries(queryClient, request.edition.id),
      ]);
      toast.success('出場追加依頼を承認しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectParticipationMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await apiClient.POST('/api/admin/participation-requests/{id}/reject', {
        params: { path: { id } },
        body: {},
      });
      return throwIfError(result);
    },
    onSuccess: async () => {
      await invalidateAdminParticipationRequestQueries(queryClient);
      toast.success('出場追加依頼を却下しました');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return {
    universityRequests: (universityRequestsQuery.data?.data ??
      []) as AdminUniversityRequestsResponse['data'],
    universityPagination: universityRequestsQuery.data?.pagination,
    setUniversityPage: (page: number) => setUniversityQueryParams({ universityPage: page }),
    setUniversityPageSize: (pageSize: number) =>
      setUniversityQueryParams({ universityPageSize: pageSize, universityPage: 1 }),
    participationRequests: (participationRequestsQuery.data?.data ??
      []) as AdminParticipationRequestsResponse['data'],
    participationPagination: participationRequestsQuery.data?.pagination,
    setParticipationPage: (page: number) =>
      setParticipationQueryParams({ participationPage: page }),
    setParticipationPageSize: (pageSize: number) =>
      setParticipationQueryParams({ participationPageSize: pageSize, participationPage: 1 }),
    isLoading: universityRequestsQuery.isLoading || participationRequestsQuery.isLoading,
    approveUniversityMutation,
    rejectUniversityMutation,
    approveParticipationMutation,
    rejectParticipationMutation,
  };
}
