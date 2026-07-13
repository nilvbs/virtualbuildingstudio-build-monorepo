import type { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppShell section="admin">{children}</AppShell>;
}
