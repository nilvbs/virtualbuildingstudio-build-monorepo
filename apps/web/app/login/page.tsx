import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ auth: 'login' });
  if (sp.created) q.set('created', '1');
  if (sp.role === 'client' || sp.role === 'surveyor') q.set('role', sp.role);
  redirect(`/?${q.toString()}`);
}
