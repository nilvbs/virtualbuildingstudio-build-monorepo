import type { ReactNode } from 'react';
import { AppShell } from '../../../../components/app-shell';

export default function AdminHelpdeskLayout({ children }: { children: ReactNode }) {
  return <AppShell section="admin">{children}</AppShell>;
}
