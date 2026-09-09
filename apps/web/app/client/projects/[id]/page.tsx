'use client';

import { use, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, MapPin, Sparkles, UserCheck } from 'lucide-react';
import {
  SURVEY_SERVICE_LABELS,
  clientProjectHeadline,
  type ProjectDetail,
  type ProjectStatus,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../../lib/api';
import { StatusBadge } from '../../../../components/status';
import { LocationMapPreview } from '../../../../components/location-map-preview';

const FINDING = new Set<ProjectStatus>(['submitted', 'matching']);

const STEPS: Array<{ status: ProjectStatus; title: string; desc: string }> = [
  { status: 'submitted', title: 'Project submitted', desc: 'We received your request.' },
  {
    status: 'matching',
    title: 'Notifying surveyors',
    desc: 'Nearby experts have a few working hours to respond.',
  },
  { status: 'matched', title: 'Surveyor matched', desc: 'Someone accepted your project.' },
  { status: 'confirmed', title: 'Visit confirmed', desc: 'Timing and details will be locked in.' },
  { status: 'completed', title: 'Survey complete', desc: 'Your deliverables will be on the way.' },
];

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  within_3_days: 'Within 3 days',
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
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [router, id]);

  if (loading) {
    return (
      <div className="cli-detail">
        <div className="skeleton sk-line" style={{ width: 160, height: 20 }} />
        <div className="cli-detail-panel skeleton" style={{ marginTop: 16, minHeight: 180 }} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="cli-detail">
        <div className="alert error">{error ?? 'Project not found.'}</div>
        <Link href="/client" className="btn secondary sm">
          <ArrowLeft size={15} /> Back to your projects
        </Link>
      </div>
    );
  }

  const { headline, subtext } = clientProjectHeadline(project.status);
  const searching = FINDING.has(project.status);
  const cancelled = project.status === 'cancelled';
  const currentIndex = progressIndex(project.status);
  const timelineLabel = project.neededWithin
    ? (TIMELINE_LABELS[project.neededWithin] ?? project.neededWithin.replaceAll('_', ' '))
    : null;

  const visibleMatches = project.matches.filter((m) =>
    ['proposed', 'accepted', 'completed'].includes(m.status),
  );

  return (
    <div className="cli-detail">
      <Link href="/client" className="cli-detail-back plain">
        <ArrowLeft size={15} /> Projects
      </Link>

      <header className="cli-detail-hero">
        <div className="cli-detail-hero-copy">
          <p className="ops-kicker">Project</p>
          <h1 className="cli-detail-title">{project.title}</h1>
          {project.locationText ? (
            <p className="cli-detail-sub">
              <MapPin size={14} aria-hidden /> {project.locationText}
            </p>
          ) : null}
          <div className="cli-detail-tags">
            {project.services.map((s) => (
              <span key={s} className="admin-svy-tag">
                {serviceLabel(s)}
              </span>
            ))}
          </div>
        </div>
        <StatusBadge status={project.status} />
      </header>

      <section className="cli-detail-panel cli-detail-status">
        <div className="cli-detail-status-ico" aria-hidden>
          <div className={`pulse ${searching ? '' : 'green'}`}>
            {searching ? <Sparkles size={20} /> : <Check size={22} strokeWidth={2.6} />}
          </div>
        </div>
        <div>
          <h2 className="cli-detail-status-title">{headline}</h2>
          <p className="cli-detail-status-sub">{subtext}</p>
          {searching ? (
            <Link href={`/client/projects/${project.id}/surveyors`} className="btn sm" style={{ marginTop: 12 }}>
              Browse matching surveyors
            </Link>
          ) : null}
        </div>
      </section>

      {!cancelled && (
        <section className="cli-detail-panel">
          <h2 className="cli-detail-panel-title">Progress</h2>
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

      {visibleMatches.length > 0 && (
        <section className="cli-detail-panel">
          <h2 className="cli-detail-panel-title">Matches</h2>
          <div className="cli-detail-match-list">
            {visibleMatches.map((m) => (
              <article className="cli-detail-match" key={m.matchId}>
                <span className="cli-detail-match-ico" aria-hidden>
                  <UserCheck size={16} />
                </span>
                <div className="cli-detail-match-copy">
                  <strong>
                    {m.surveyorUsername ? `@${m.surveyorUsername}` : 'Surveyor'}
                  </strong>
                  <span>
                    {m.surveyorBaseCity || 'Location pending'}
                    {' · '}
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <StatusBadge status={m.status} />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="cli-detail-panel">
        <h2 className="cli-detail-panel-title">Project details</h2>
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
        <Detail label="Building type">
          {project.buildingType ? project.buildingType.replaceAll('_', ' ') : null}
        </Detail>
        <Detail label="Building age">{project.buildingAge}</Detail>
        <Detail label="Floors">{project.floors}</Detail>
        <Detail label="Area (sq ft)">
          {project.areaSqft != null ? project.areaSqft.toLocaleString() : null}
        </Detail>
        <Detail label="Needed within">{timelineLabel}</Detail>
        <Detail label="Notes">{project.notes}</Detail>

        {project.location ? (
          <div style={{ marginTop: 14 }}>
            <LocationMapPreview
              lat={project.location.lat}
              lng={project.location.lng}
              label={project.locationText}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
