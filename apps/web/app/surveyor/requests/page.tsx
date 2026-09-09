'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Inbox,
  MapPin,
  Building2,
  Clock,
  Layers,
  Ruler,
  CheckCircle,
  XCircle,
  Navigation,
} from 'lucide-react';
import {
  SURVEY_SERVICE_LABELS,
  type SurveyorRequest,
  type SurveyService,
} from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { LocationMapPreview } from '../../../components/location-map-preview';

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

function formatWorkingCountdown(ms: number | null): string {
  if (ms == null) return '—';
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function WorkingHoursTimer({
  remainingWorkingMs,
  paused,
  expiresAt,
}: {
  remainingWorkingMs: number | null;
  paused: boolean;
  expiresAt: string | null;
}) {
  const [remaining, setRemaining] = useState(remainingWorkingMs);

  useEffect(() => {
    setRemaining(remainingWorkingMs);
  }, [remainingWorkingMs]);

  useEffect(() => {
    if (paused || remaining == null || remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => (prev == null ? prev : Math.max(0, prev - 60_000)));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [paused, remaining]);

  if (!expiresAt) return null;

  return (
    <div className={`svy-req-timer${paused ? ' is-paused' : ''}${remaining === 0 ? ' is-expired' : ''}`}>
      <Clock size={14} aria-hidden />
      <div>
        <strong>{remaining === 0 ? 'Window ended' : formatWorkingCountdown(remaining)}</strong>
        <span>
          {paused
            ? 'Timer paused outside official working hours (Mon–Fri)'
            : 'Working hours left to accept'}
        </span>
      </div>
    </div>
  );
}

export default function SurveyorRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<SurveyorRequest[]>([]);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rows, me] = await Promise.all([api.getSurveyorRequests(), api.me()]);
        if (cancelled) return;
        setRequests(rows);
        setUserName(me.fullName ?? '');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = window.setInterval(() => {
      void api
        .getSurveyorRequests()
        .then((rows) => {
          if (!cancelled) setRequests(rows);
        })
        .catch(() => undefined);
    }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router]);

  const greeting = useMemo(() => firstName(userName), [userName]);

  const handleAccept = async (matchId: string) => {
    setActing(matchId);
    try {
      await api.acceptMatch(matchId);
      setRequests((prev) => prev.filter((r) => r.matchId !== matchId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(null);
    }
  };

  const handleDecline = async (matchId: string) => {
    setActing(matchId);
    try {
      await api.declineMatch(matchId);
      setRequests((prev) => prev.filter((r) => r.matchId !== matchId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="svy-req">
        <div className="skeleton sk-line" style={{ width: 240, height: 28 }} />
        <div className="svy-req-list" style={{ marginTop: 12 }}>
          <div className="svy-req-card skeleton" style={{ minHeight: 128 }} />
        </div>
      </div>
    );
  }

  if (error) return <div className="alert error">{error}</div>;

  return (
    <div className="svy-req">
      <header className="svy-req-hello">
        <h1 className="svy-req-hello-title">
          Hi {greeting}
          {requests.length > 0 ? <span className="svy-req-count">{requests.length}</span> : null}
        </h1>
        <p className="svy-req-hello-copy">
          {requests.length === 0
            ? 'You’re all caught up — new fitted projects will land here.'
            : requests.length === 1
              ? 'You’ve got a project waiting. Take a look and accept if it’s a fit.'
              : `You’ve got ${requests.length} projects waiting. Review each one and accept the ones that fit.`}
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="empty svy-req-empty">
          <div className="empty-ico">
            <Inbox size={22} />
          </div>
          <h2 style={{ fontSize: 17 }}>No pending requests</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 380, margin: '6px auto 0' }}>
            When a project is matched to you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="svy-req-list">
          {requests.map((req) => (
            <RequestCard
              key={req.matchId}
              request={req}
              busy={acting === req.matchId}
              onAccept={() => handleAccept(req.matchId)}
              onDecline={() => handleDecline(req.matchId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: SurveyorRequest;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { project, client } = request;
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
    <article className={`svy-req-card svy-req-card--ringing${busy ? ' is-busy' : ''}`}>
      <div className="svy-req-card-top">
        <span className="svy-req-avatar" aria-hidden>
          {(client.username.trim()[0] ?? 'P').toUpperCase()}
        </span>
        <div className="svy-req-heading-text">
          <div className="svy-req-title-row">
            <h2 className="svy-req-card-title">{project.title}</h2>
            <span className="svy-req-pill">Incoming</span>
          </div>
          <p className="svy-req-card-client">
            From @{client.username}
            {client.companyName ? ` · ${client.companyName}` : ''}
            <span className="svy-req-dot" aria-hidden>
              ·
            </span>
            <time dateTime={request.createdAt}>
              {new Date(request.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </time>
          </p>
        </div>
      </div>

      <WorkingHoursTimer
        remainingWorkingMs={request.remainingWorkingMs}
        paused={request.responseWindowPaused}
        expiresAt={request.expiresAt}
      />

      {meta.length > 0 ? (
        <ul className="svy-req-meta">
          {meta.map((m) => (
            <li key={m.text}>
              {m.icon}
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {project.services.length > 0 ? (
        <div className="svy-req-services">
          {project.services.map((s) => (
            <span key={s} className="svy-req-tag">
              {serviceLabel(s)}
            </span>
          ))}
        </div>
      ) : null}

      {project.notes ? <p className="svy-req-notes">{project.notes}</p> : null}

      {project.location ? (
        <LocationMapPreview
          lat={project.location.lat}
          lng={project.location.lng}
          label={project.locationText}
          className="svy-req-map"
        />
      ) : null}

      <div className="svy-req-actions">
        <button type="button" className="btn svy-req-accept" disabled={busy} onClick={onAccept}>
          {busy ? <span className="spin" /> : <CheckCircle size={15} />}
          Accept
        </button>
        <button type="button" className="btn secondary svy-req-decline" disabled={busy} onClick={onDecline}>
          <XCircle size={15} />
          Decline
        </button>
      </div>
    </article>
  );
}
