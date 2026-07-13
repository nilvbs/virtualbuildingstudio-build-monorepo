import { redirect } from 'next/navigation';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams({ auth: 'signup' });
  if (sp.role === 'client' || sp.role === 'surveyor') q.set('role', sp.role);
  redirect(`/?${q.toString()}`);
}
