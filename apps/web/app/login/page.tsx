import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ auth: 'login' });
  if (sp.created) q.set('created', '1');
  redirect(`/?${q.toString()}`);
}
