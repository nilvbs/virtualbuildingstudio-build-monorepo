'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { clientProjectHeadline, type ProjectDetail, type ProjectStatus } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { StatusBadge } from '../../../../components/status';

const FINDING = new Set<ProjectStatus>(['submitted', 'matching']);

const STEPS: Array<{ status: ProjectStatus; title: string; desc: string }> = [
  { status: 'submitted', title: 'Project submitted', desc: 'We received your request.' },
  { status: 'matching', title: 'Finding a surveyor', desc: 'Matching you to someone nearby.' },
  { status: 'matched', title: 'Surveyor matched', desc: "We've found a surveyor for you." },
  { status: 'confirmed', title: 'Visit confirmed', desc: 'Timing and details are locked in.' },
  { status: 'completed', title: 'Survey complete', desc: 'Your deliverables are on the way.' },
];

function Detail({ label, value }: { label: string; value: string | number | null }) {
  if (value === null || value === '' || value === undefined) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getProject(id)
      .then(setProject)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router, id]);

  if (loading) {
    return (
      <>
        <div className="skeleton sk-line" style={{ width: 160, height: 20 }} />
        <div className="card" style={{ marginTop: 20, height: 200 }} />
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <div className="alert error">{error ?? 'Project not found.'}</div>
        <Link href="/client" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to your projects
        </Link>
      </>
    );
  }

  const { headline, subtext } = clientProjectHeadline(project.status);
  const searching = FINDING.has(project.status);
  const cancelled = project.status === 'cancelled';
  const currentIndex = STEPS.findIndex((s) => s.status === project.status);

  return (
    <>
      <Link
        href="/client"
        className="plain"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13.5, marginBottom: 14 }}
      >
        <ArrowLeft size={15} /> Your projects
      </Link>

      <div className="page-head">
        <div>
          <p className="kicker">Project</p>
          <h1 className="page-title">{project.title}</h1>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <section
        className="card card-pad-lg"
        style={{ display: 'grid', placeItems: 'center', textAlign: 'center', background: 'var(--brand-grad-soft)', borderColor: 'transparent' }}
      >
        <div className={`pulse ${searching ? '' : 'green'}`} aria-hidden>
          {searching ? <Sparkles size={26} /> : <Check size={28} strokeWidth={2.6} />}
        </div>
        <h2 style={{ fontSize: 24, margin: '18px 0 8px', maxWidth: 520 }}>{headline}</h2>
        <p style={{ color: 'var(--text-soft)', maxWidth: 460 }}>{subtext}</p>
      </section>

      {!cancelled && (
        <section className="card" style={{ marginTop: 22 }}>
          <div className="section-title">Progress</div>
          <div className="timeline">
            {STEPS.map((step, i) => {
              const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
              return (
                <div className={`tl-step ${state}`} key={step.status}>
                  <span className="tl-dot">
                    {state === 'done' ? <Check size={15} strokeWidth={3} /> : i + 1}
                  </span>
                  <div>
                    <div className="tl-title">{step.title}</div>
                    <div className="tl-desc">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {project.matches.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <div className="section-title">Your match</div>
          <div className="list">
            {project.matches.map((m) => (
              <div className="row-item" key={m.matchId}>
                <div>
                  <strong>Surveyor{m.surveyorBaseCity ? ` · ${m.surveyorBaseCity}` : ''}</strong>
                  <div className="row-meta">{new Date(m.createdAt).toLocaleDateString()}</div>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: 22 }}>
        <div className="section-title">Project details</div>
        <Detail label="Services" value={project.services.join(', ')} />
        <Detail label="Location" value={project.locationText} />
        <Detail
          label="Coordinates"
          value={project.location ? `${project.location.lat}, ${project.location.lng}` : null}
        />
        <Detail label="Building type" value={project.buildingType} />
        <Detail label="Building age" value={project.buildingAge} />
        <Detail label="Floors" value={project.floors} />
        <Detail label="Area (sq ft)" value={project.areaSqft} />
        <Detail label="Needed within" value={project.neededWithin} />
        <Detail label="Notes" value={project.notes} />
      </section>
    </>
  );
}
