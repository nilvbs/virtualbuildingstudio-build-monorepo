'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, MapPin, Building2, Clock, Ruler, CheckCircle, XCircle } from 'lucide-react';
import type { SurveyorRequest } from '@surveylink/types';
import { api, ApiError, errorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/status';

export default function SurveyorRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<SurveyorRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = () => {
    api
      .getSurveyorRequests()
      .then(setRequests)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/sign-in');
        else setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [router]);

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
      <>
        <div className="skeleton sk-line" style={{ width: 180, height: 20 }} />
        <div className="card" style={{ marginTop: 20, height: 180 }} />
      </>
    );
  }

  if (error) return <div className="alert error">{error}</div>;

  return (
    <>
      <div className="section-title">
        My Requests <span className="count">{requests.length}</span>
      </div>

      {requests.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">
            <Inbox size={24} />
          </div>
          <h2 style={{ fontSize: 20 }}>No pending requests</h2>
          <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '8px auto 0' }}>
            When a project is matched to you, it will appear here for you to accept or decline.
          </p>
        </div>
      ) : (
        <div className="requests-list">
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
    </>
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

  return (
    <div className="request-card">
      <div className="request-card-header">
        <div>
          <h3 className="request-card-title">{project.title}</h3>
          <p className="request-card-client">
            {client.fullName}
            {client.companyName ? ` · ${client.companyName}` : ''}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="request-card-details">
        {project.locationText && (
          <Detail icon={<MapPin size={15} />} label="Location" value={project.locationText} />
        )}
        {project.buildingType && (
          <Detail icon={<Building2 size={15} />} label="Building" value={`${project.buildingType}${project.buildingAge ? ` · ${project.buildingAge}` : ''}`} />
        )}
        {project.floors != null && (
          <Detail icon={<Building2 size={15} />} label="Floors" value={String(project.floors)} />
        )}
        {project.areaSqft != null && (
          <Detail icon={<Ruler size={15} />} label="Area" value={`${project.areaSqft.toLocaleString()} sq ft`} />
        )}
        {project.neededWithin && (
          <Detail icon={<Clock size={15} />} label="Timeline" value={project.neededWithin} />
        )}
        {project.services.length > 0 && (
          <div className="request-card-services">
            <span className="detail-label">Services:</span>
            <div className="service-tags">
              {project.services.map((s) => (
                <span key={s} className="service-tag">{s}</span>
              ))}
            </div>
          </div>
        )}
        {project.notes && (
          <div className="request-card-notes">
            <span className="detail-label">Notes:</span>
            <p>{project.notes}</p>
          </div>
        )}
      </div>

      <div className="request-card-meta">
        Requested {new Date(request.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
      </div>

      <div className="request-card-actions">
        <button
          className="btn btn-accept"
          disabled={busy}
          onClick={onAccept}
        >
          <CheckCircle size={16} />
          Accept
        </button>
        <button
          className="btn btn-decline"
          disabled={busy}
          onClick={onDecline}
        >
          <XCircle size={16} />
          Decline
        </button>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="request-detail-row">
      <span className="detail-icon">{icon}</span>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
