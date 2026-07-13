import { redirect } from 'next/navigation';

export default function LegacyAdminRedirect() {
  redirect('/build/admin/queue');
}
