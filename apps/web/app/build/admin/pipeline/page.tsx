'use client';

import { Suspense } from 'react';
import AdminProjectsPageInner from '../projects/projects-inner';

export default function AdminPipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="admin-proj">
          <div className="skeleton sk-line" style={{ width: 220, height: 22 }} />
          <div className="entity-card-grid" style={{ marginTop: 16 }}>
            <div className="entity-card skeleton" style={{ minHeight: 140 }} />
          </div>
        </div>
      }
    >
      <AdminProjectsPageInner scope="pipeline" />
    </Suspense>
  );
}
