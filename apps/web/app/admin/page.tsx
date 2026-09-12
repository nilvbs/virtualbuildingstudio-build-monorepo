import { redirect } from 'next/navigation';

/** Short path into the staff portal (login / ops). */
export default function LegacyAdminRedirect() {
  redirect('/build/admin');
}
