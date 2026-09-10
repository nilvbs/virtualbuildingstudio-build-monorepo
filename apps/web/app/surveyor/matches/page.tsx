'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  CheckCircle,
  Clock,
  Handshake,
  Layers,
  MapPin,
  Navigation,
  Ruler,
} from 'lucide-react';
import {
  SURVEY_SERVICE_LABELS,
  type SurveyorRequest,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { LocationMapPreview } from '../../../components/location-map-preview';
import { StatusBadge } from '../../../components/status';
import { FeedbackForm } from '../../../components/feedback-form';

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  within_3_days: 'Within 3 days',
  '2_weeks': 'Within 2 weeks',
  '1_month': 'Within a month',
  flexible: 'Flexible',
};

function serviceLabel(service: string): string {
  return SURVEY_SERVICE_LABELS[service as SurveyService] ?? service.replaceAll('_', ' ');
}

function timelineLabel(value: string): string {
  return TIMELINE_LABELS[value] ?? value.replaceAll('_', ' ');
}

function buildingLabel(type: string): string {
  return type.replaceAll('_', ' ');
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || 'there';
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m from your base`;
  const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return `${rounded} km from your base`;
}

export default function SurveyorMatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<SurveyorRequest[] | null>(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [status, rows, me] = await Promise.all([
          api.getSurveyorStatus(),
          api.getSurveyorMatches(),
          api.me(),
        ]);
        if (cancelled) return;
        setProfileComplete(status.profileComplete);
        setCompletionPercent(status.completionPercent);
        setMatches(rows);
        setUserName(me.fullName ?? '');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const greeting = useMemo(() => firstName(userName), [userName]);

  if (loading) {
    return (
      <div className="svy-match">
        <div className="skeleton sk-line" style={{ width: 220, height: 28 }} />
        <div className="svy-match-list" style={{ marginTop: 12 }}>
          <div className="svy-match-card skeleton" style={{ minHeight: 180 }} />
        </div>
      </div>
    );
  }

  if (error) return <div className="alert error">{error}</div>;
  if (!matches) return null;

  return (
    <div className="svy-match">
      {!profileComplete ? (
        <div className="empty">
          <div className="empty-ico">
            <Handshake size={24} />
          </div>
          <h2 style={{ fontSize: 20 }}>Complete your portfolio first</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '8px auto 18px' }}>
            Matches appear once your portfolio is 100% complete and you accept a project request.
          </p>
          <Link className="btn" href="/surveyor/profile">
            Finish portfolio · {completionPercent}%
          </Link>
        </div>
      ) : (
        <>
          <header className="svy-match-hello">
            <h1 className="svy-match-hello-title">
              Hi {greeting}
              {matches.length > 0 ? <span className="svy-match-count">{matches.length}</span> : null}
            </h1>
            <p className="svy-match-hello-copy">
              {matches.length === 0
                ? 'Accepted projects will show up here with site details and distance from your base.'
                : matches.length === 1
                  ? 'Here’s your accepted project — site map and travel distance included.'
                  : `Here’s your accepted work — ${matches.length} projects with maps and distances.`}
            </p>
          </header>

          {matches.length === 0 ? (
            <div className="empty svy-match-empty">
              <div className="empty-ico">
                <CheckCircle size={24} />
              </div>
              <h2 style={{ fontSize: 17 }}>No accepted matches yet</h2>
              <p style={{ color: 'var(--muted)', maxWidth: 400, margin: '6px auto 14px' }}>
                When you accept a project from My Requests, it lands here. Declined requests stay
                hidden.
              </p>
              <Link className="btn secondary" href="/surveyor/requests">
                Open My Requests
              </Link>
            </div>
          ) : (
            <div className="svy-match-list">
              {matches.map((m) => (
                <MatchCard
                  key={m.matchId}
                  match={m}
                  onFeedback={() => {
                    api.getSurveyorMatches().then(setMatches).catch(() => undefined);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchCard({
  match,
  onFeedback,
}: {
  match: SurveyorRequest;
  onFeedback?: () => void;
}) {
  const { project, client } = match;
  const meta = [
    project.locationText ? { icon: <MapPin size={13} />, text: project.locationText } : null,
    project.distanceKm != null
      ? { icon: <Navigation size={13} />, text: formatDistance(project.distanceKm) }
      : null,
    project.buildingType
      ? {
          icon: <Building2 size={13} />,
          text: `${buildingLabel(project.buildingType)}${project.buildingAge ? ` · ${project.buildingAge}` : ''}`,
        }
      : null,
    project.floors != null ? { icon: <Layers size={13} />, text: `${project.floors} floors` } : null,
    project.areaSqft != null
      ? { icon: <Ruler size={13} />, text: `${project.areaSqft.toLocaleString()} sq ft` }
      : null,
    project.neededWithin
      ? { icon: <Clock size={13} />, text: timelineLabel(project.neededWithin) }
      : null,
  ].filter(Boolean) as { icon: ReactNode; text: string }[];

  return (
    <article className="svy-match-card">
      <div className="svy-match-card-top">
        <span className="svy-match-avatar" aria-hidden>
          {(client.username.trim()[0] ?? 'P').toUpperCase()}
        </span>
        <div className="svy-match-heading-text">
          <div className="svy-match-title-row">
            <h2 className="svy-match-card-title">{project.title}</h2>
            <StatusBadge status={match.status} />
          </div>
          <p className="svy-match-card-client">
            With @{client.username}
            {client.companyName ? ` · ${client.companyName}` : ''}
            <span className="svy-match-dot" aria-hidden>
              ·
            </span>
            <time dateTime={match.createdAt}>
              Accepted {new Date(match.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </time>
          </p>
          {match.feedbackSubmitted ? (
            <p className="fb-inline-done">Your feedback was submitted</p>
          ) : null}
        </div>
      </div>

      {meta.length > 0 ? (
        <ul className="svy-match-meta">
          {meta.map((m) => (
            <li key={m.text}>
              {m.icon}
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {project.services.length > 0 ? (
        <div className="svy-match-services">
          {project.services.map((s) => (
            <span key={s} className="svy-match-tag">
              {serviceLabel(s)}
            </span>
          ))}
        </div>
      ) : null}

      {project.notes ? <p className="svy-match-notes">{project.notes}</p> : null}

      {project.location ? (
        <LocationMapPreview
          lat={project.location.lat}
          lng={project.location.lng}
          label={project.locationText}
          className="svy-match-map"
        />
      ) : project.locationText ? (
        <div className="svy-match-map-fallback">
          <MapPin size={14} aria-hidden />
          <span>{project.locationText}</span>
        </div>
      ) : null}

      {match.canLeaveFeedback ? (
        <div className="svy-match-feedback">
          <FeedbackForm
            matchId={match.matchId}
            counterpartLabel={`@${client.username}`}
            projectTitle={project.title}
            role="surveyor"
            onSubmitted={onFeedback}
          />
        </div>
      ) : null}
    </article>
  );
}
