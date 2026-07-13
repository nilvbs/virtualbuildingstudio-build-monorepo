import type { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell';

export default function SurveyorLayout({ children }: { children: ReactNode }) {
  return <AppShell section="surveyor">{children}</AppShell>;
}
