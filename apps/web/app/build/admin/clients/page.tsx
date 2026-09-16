import { redirect } from 'next/navigation';

/** Clients list merged into Users — keep deep links working via role filter. */
export default function AdminClientsRedirectPage() {
  redirect('/build/admin/users?role=client');
}
