'use client';

import { Suspense } from 'react';
import { HelpDeskWorkspace } from '../../../components/help-desk-workspace';

export default function SurveyorHelpPage() {
  return (
    <Suspense fallback={<div className="hd-loading">Loading help…</div>}>
      <HelpDeskWorkspace workspace="surveyor" />
    </Suspense>
  );
}
