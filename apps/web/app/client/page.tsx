'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Building2, FolderPlus, Plus } from 'lucide-react';
import { clientProjectHeadline, type Project } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/status';

export default function ClientDashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getProjects()
      .then(setProjects)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="kicker">Client</p>
          <h1 className="page-title">Your projects</h1>
          <p className="page-sub">Post a project and we&apos;ll match you to a vetted surveyor.</p>
        </div>
        <Link className="btn" href="/client/projects/new">
          <Plus size={17} /> Post a project
        </Link>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading && (
        <div className="list">
          {[0, 1, 2].map((i) => (
            <div className="row-item" key={i}>
              <div className="row-lead" style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 10 }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton sk-line" style={{ width: '45%' }} />
                  <div className="skeleton sk-line" style={{ width: '70%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects && projects.length === 0 && (
        <div className="empty">
          <div className="empty-ico">
            <FolderPlus size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>No projects yet</h3>
          <p style={{ color: 'var(--muted)', margin: '6px 0 18px' }}>
            Post your first project and our team gets to work finding the right surveyor.
          </p>
          <Link className="btn" href="/client/projects/new">
            <Plus size={17} /> Post a project
          </Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="list stagger">
          {projects.map((p) => {
            const { headline } = clientProjectHeadline(p.status);
            return (
              <Link key={p.id} href={`/client/projects/${p.id}`} className="plain">
                <div className="row-item">
                  <div className="row-lead">
                    <span className="row-ico">
                      <Building2 size={18} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row-title">{p.title}</div>
                      <div className="row-meta">{headline}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <StatusBadge status={p.status} />
                    <ArrowRight size={17} style={{ color: 'var(--faint)' }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
