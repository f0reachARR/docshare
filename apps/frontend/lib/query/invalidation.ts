import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

export async function invalidateAdminSeriesQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.seriesPrefix() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.series.prefix() }),
  ]);
}

export async function invalidateAdminEditionsQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.editionsPrefix() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.editions.prefix() }),
  ]);
}

export async function invalidateAdminTemplatesQueries(
  queryClient: QueryClient,
  editionId: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.admin.templatesPrefix(editionId) });
}
