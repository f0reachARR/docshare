import { redirect } from 'next/navigation';

export default async function SubmissionsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/competitions/${id}`);
}
