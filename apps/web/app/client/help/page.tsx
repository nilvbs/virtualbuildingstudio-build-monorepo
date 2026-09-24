'use client';

import { Suspense } from 'react';
import { HelpDeskWorkspace } from '../../../components/help-desk-workspace';

export default function ClientHelpPage() {
  return (
    <Suspense fallback={<div className="hd-loading">Loading help…</div>}>
      <HelpDeskWorkspace workspace="client" />
    </Suspense>
  );
}
