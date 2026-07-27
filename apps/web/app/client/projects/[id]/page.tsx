'use client';

import { use, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import {
  SURVEY_SERVICE_LABELS,
  clientProjectHeadline,
  type ProjectDetail,
  type ProjectStatus,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { StatusBadge } from '../../../../components/status';

const FINDING = new Set<ProjectStatus>(['submitted', 'matching']);

const STEPS: Array<{ status: ProjectStatus; title: string; desc: string }> = [
  { status: 'submitted', title: 'Project submitted', desc: 'We received your request.' },
  { status: 'matching', title: 'Finding a surveyor', desc: 'Matching you to someone nearby.' },
  { status: 'matched', title: 'Surveyor matched', desc: "We'll show you who we found." },
  { status: 'confirmed', title: 'Visit confirmed', desc: 'Timing and details will be locked in.' },
  { status: 'completed', title: 'Survey complete', desc: 'Your deliverables will be on the way.' },
];

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  '2_weeks': 'Within 2 weeks',
  '1_month': 'Within a month',
  flexible: 'Flexible',
};

function progressIndex(status: ProjectStatus): number {
  if (status === 'submitted' || status === 'matching') return 1;
  return STEPS.findIndex((s) => s.status === status);
}

function serviceLabel(service: string): string {
  return SURVEY_SERVICE_LABELS[service as SurveyService] ?? service.replaceAll('_', ' ');
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null;
  return (
    <div className="detail-row">
      <span className="detail-row-label">{label}</span>
      <div className="detail-row-value">{children}</div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="info-chip">{children}</span>;
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
  const currentIndex = progressIndex(project.status);
  const timelineLabel = project.neededWithin
    ? (TIMELINE_LABELS[project.neededWithin] ?? project.neededWithin.replaceAll('_', ' '))
    : null;

  return (
    <div className="project-detail">
      <Link href="/client" className="project-detail-back plain">
        <ArrowLeft size={15} /> Back
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">{project.title}</h1>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <section className="card project-status-hero">
        <div className="project-status-hero-ico">
          <div className={`pulse ${searching ? '' : 'green'}`} aria-hidden>
            {searching ? <Sparkles size={22} /> : <Check size={24} strokeWidth={2.6} />}
          </div>
        </div>
        <h2 className="project-status-hero-title">{headline}</h2>
        <p className="project-status-hero-sub">{subtext}</p>
        {searching ? (
          <Link href={`/client/projects/${project.id}/surveyors`} className="btn" style={{ marginTop: 16 }}>
            Browse matching surveyors
          </Link>
        ) : null}
      </section>

      {!cancelled && (
        <section className="card">
          <div className="section-title">Progress</div>
          <ol className="timeline">
            {STEPS.map((step, i) => {
              const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
              return (
                <li className={`tl-step ${state}`} key={step.status}>
                  <span className="tl-dot" aria-hidden>
                    {state === 'done' ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <div className="tl-copy">
                    <div className="tl-title">{step.title}</div>
                    <div className="tl-desc">{step.desc}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {project.matches.length > 0 && (
        <section>
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

      <section className="card">
        <div className="section-title">Project details</div>
        <Detail label="Services">
          {project.services.length > 0 ? (
            <div className="info-chip-row">
              {project.services.map((service) => (
                <Chip key={service}>{serviceLabel(service)}</Chip>
              ))}
            </div>
          ) : null}
        </Detail>
        <Detail label="Location">{project.locationText}</Detail>
        <Detail label="Coordinates">
          {project.location ? `${project.location.lat}, ${project.location.lng}` : null}
        </Detail>
        <Detail label="Building type">
          {project.buildingType ? (
            <div className="info-chip-row">
              <Chip>{project.buildingType}</Chip>
            </div>
          ) : null}
        </Detail>
        <Detail label="Building age">{project.buildingAge}</Detail>
        <Detail label="Floors">{project.floors}</Detail>
        <Detail label="Area (sq ft)">{project.areaSqft}</Detail>
        <Detail label="Needed within">
          {timelineLabel ? (
            <div className="info-chip-row">
              <Chip>{timelineLabel}</Chip>
            </div>
          ) : null}
        </Detail>
        <Detail label="Notes">{project.notes}</Detail>
      </section>
    </div>
  );
}
