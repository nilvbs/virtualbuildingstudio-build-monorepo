import type { ReactNode } from 'react';
import { AppShell } from '../../../../components/app-shell';

export default function BuildAdminFeedbackLayout({ children }: { children: ReactNode }) {
  return <AppShell section="admin">{children}</AppShell>;
}
