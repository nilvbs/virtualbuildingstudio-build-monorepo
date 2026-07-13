import { redirect } from 'next/navigation';

export default async function LegacyAdminProjectRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/build/admin/projects/${id}`);
}
