'use client';

import { useState } from 'react';
import { Check, MapPin } from 'lucide-react';

const TRUST = ['Hand-matched', 'Vetted network', 'Dedicated workspace'] as const;

const FLOW_STEPS = [
  {
    id: 'request',
    title: 'Request',
    summary: 'Share your site, scope, and timing once — no bidding wars.',
    stageLabel: 'New request',
    stageTitle: 'Site intake',
    stageBody: 'Property details, survey type, and schedule in one clear brief.',
    image: '/brand/path-client.png?v=3',
    meta: 'Client workspace',
    highlights: ['Site details', 'Survey type', 'Preferred timing'],
  },
  {
    id: 'match',
    title: 'Match',
    summary: 'We hand-match vetted surveyors by coverage, kit, and fit.',
    stageLabel: 'Matching',
    stageTitle: 'Specialist fit',
    stageBody: 'Coverage, equipment, and experience aligned to your property.',
    image: '/brand/path-surveyor.png?v=3',
    meta: 'Curated shortlist',
    highlights: ['Coverage fit', 'Kit match', 'Reviewed by hand'],
  },
  {
    id: 'confirm',
    title: 'Confirm',
    summary: 'Review the match in your workspace and lock in the visit.',
    stageLabel: 'Ready to confirm',
    stageTitle: 'Visit locked',
    stageBody: 'Clear scope, coverage, and next steps before anyone mobilizes.',
    image: '/brand/landing-hero-mobile.png',
    meta: 'Shared timeline',
    highlights: ['Scope review', 'Confirm visit', 'Shared timeline'],
  },
  {
    id: 'deliver',
    title: 'Deliver',
    summary: 'On-site work with a clean trail from request to completion.',
    stageLabel: 'In progress',
    stageTitle: 'Field delivery',
    stageBody: 'Status, notes, and handoff stay visible until the survey is done.',
    image: '/brand/path-deliver.png?v=2',
    meta: 'Live status',
    highlights: ['Live status', 'Field notes', 'Clean handoff'],
  },
] as const;

export function LandingFlow() {
  const [active, setActive] = useState(0);
  const step = FLOW_STEPS[active] ?? FLOW_STEPS[0];

  return (
    <div className="bld-flow-shell">
      <div className="bld-flow-intro">
        <p className="bld-flow-eyebrow">Managed matching, end to end</p>
        <h2 id="bld-flow-title" className="bld-flow-title">
          Your site, matched with clarity. <span>At every step.</span>
        </h2>
        <ul className="bld-flow-trust">
          {TRUST.map((item) => (
            <li key={item}>
              <span className="bld-flow-trust-check" aria-hidden>
                <Check size={12} strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="bld-flow-stage" aria-live="polite">
        <div className="bld-flow-stage-chrome">
          <div className="bld-flow-stage-brand">
            <img src="/brand/bld-logo-dark.png" alt="" width={72} height={28} />
          </div>
          <div className="bld-flow-stage-bar">
            <p className="bld-flow-stage-site">
              <MapPin size={14} strokeWidth={2.4} aria-hidden />
              <span>412 Market Street</span>
              <Check size={14} strokeWidth={2.6} className="bld-flow-stage-ok" aria-hidden />
            </p>
            <span className="bld-flow-stage-chip">{step.meta}</span>
          </div>
          <div className="bld-flow-stage-tabs" role="tablist" aria-label="Flow preview">
            {FLOW_STEPS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === active}
                className={`bld-flow-stage-tab${index === active ? ' is-active' : ''}`}
                onClick={() => setActive(index)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>

        <div key={step.id} className="bld-flow-stage-body">
          <div className="bld-flow-stage-copy">
            <p className="bld-flow-stage-kicker">
              <span className="bld-flow-stage-index" aria-hidden>
                {String(active + 1).padStart(2, '0')}
              </span>
              {step.stageLabel}
            </p>
            <h3>{step.stageTitle}</h3>
            <p className="bld-flow-stage-body-text">{step.stageBody}</p>
            <ul className="bld-flow-stage-points">
              {step.highlights.map((item) => (
                <li key={item}>
                  <span className="bld-flow-stage-point-check" aria-hidden>
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bld-flow-stage-media">
            <img src={step.image} alt="" loading="lazy" />
            <div className="bld-flow-stage-media-veil" aria-hidden />
          </div>
        </div>
      </div>

      <div className="bld-flow-rail" role="tablist" aria-label="How BLD works">
        {FLOW_STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={`bld-flow-step${index === active ? ' is-active' : ''}`}
            onClick={() => setActive(index)}
          >
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
