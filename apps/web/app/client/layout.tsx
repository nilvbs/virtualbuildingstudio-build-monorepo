import type { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return <AppShell section="client">{children}</AppShell>;
}
