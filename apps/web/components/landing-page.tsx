'use client';

import { ArrowRight } from 'lucide-react';
import { HeroBrand } from './hero-brand';
import { LandingAuthOverlay, useLandingAuth } from './landing-auth';

export function LandingPage() {
  const { open, mode, roleHint, created, openAuth, closeAuth, setMode, setRole } = useLandingAuth();

  return (
    <div className={`mkt ${open ? 'mkt-auth-open' : ''}`}>
      <section className="mkt-hero" aria-label="BLD">
        <nav className="mkt-nav">
          <div className="mkt-nav-actions">
            <button type="button" className="mkt-nav-btn mkt-nav-btn-ghost" onClick={() => openAuth('login')}>
              Sign in
            </button>
            <button
              type="button"
              className="mkt-nav-btn mkt-nav-btn-solid"
              onClick={() => openAuth('signup')}
            >
              Create account
            </button>
          </div>
        </nav>

        <div className="mkt-hero-stage">
          <div className="mkt-hero-media" aria-hidden />
          <div className="mkt-hero-media-veil" aria-hidden />
          <HeroBrand />
        </div>
      </section>

      <section className="mkt-section" id="get-started">
        <div className="mkt-section-inner">
          <h2 className="mkt-section-title">Choose your path</h2>
          <p className="mkt-section-sub">
            Whether you need a survey or deliver them, BLD keeps the process clear, human, and
            reliable.
          </p>

          <div className="mkt-paths">
            <button type="button" className="mkt-path" onClick={() => openAuth('signup', 'client')}>
              <span className="mkt-path-tag">Clients</span>
              <h2>Request a survey</h2>
              <p>
                Post your project once. We match you to a vetted surveyor near the site and stay
                with you until the visit is confirmed.
              </p>
              <span className="mkt-path-cta">
                Start as a client <ArrowRight size={16} />
              </span>
            </button>

            <button type="button" className="mkt-path" onClick={() => openAuth('signup', 'surveyor')}>
              <span className="mkt-path-tag">Surveyors</span>
              <h2>Offer your services</h2>
              <p>
                Set up your profile and coverage. We bring the right projects to you — no bidding
                wars, no cold outreach.
              </p>
              <span className="mkt-path-cta">
                Start as a surveyor <ArrowRight size={16} />
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-section-inner">
          <h2 className="mkt-section-title">How it works</h2>
          <p className="mkt-section-sub">Three steps from request to results.</p>
          <div className="mkt-steps">
            <div className="mkt-step">
              <div className="mkt-step-num">01</div>
              <h3>Tell us what you need</h3>
              <p>Share the site, services, and timing in a short project brief.</p>
            </div>
            <div className="mkt-step">
              <div className="mkt-step-num">02</div>
              <h3>We match by hand</h3>
              <p>Our team selects a surveyor who fits the location and scope.</p>
            </div>
            <div className="mkt-step">
              <div className="mkt-step-num">03</div>
              <h3>Survey delivered</h3>
              <p>Your surveyor coordinates the visit and delivers the results.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mkt-footer">
        <span>© {new Date().getFullYear()} BLD</span>
        <span>Clients &amp; surveyors · Managed matching</span>
      </footer>

      <LandingAuthOverlay
        open={open}
        mode={mode}
        roleHint={roleHint}
        created={created}
        onClose={closeAuth}
        onModeChange={setMode}
        onRoleChange={setRole}
      />
    </div>
  );
}
