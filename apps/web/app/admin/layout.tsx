import { redirect } from 'next/navigation';

export default function LegacyAdminLayout({ children }: { children: React.ReactNode }) {
  // Keep a passthrough layout so nested redirects still resolve; no AppShell here.
  return children;
}
