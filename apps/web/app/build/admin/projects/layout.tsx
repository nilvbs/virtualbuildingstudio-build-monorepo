import type { ReactNode } from 'react';
import { AppShell } from '../../../../components/app-shell';

export default function BuildAdminProjectLayout({ children }: { children: ReactNode }) {
  return <AppShell section="admin">{children}</AppShell>;
}
