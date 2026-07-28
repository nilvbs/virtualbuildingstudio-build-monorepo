'use client';

import Link from 'next/link';
import { ArrowRight, Building2, ClipboardCheck, MapPin, UserRoundSearch } from 'lucide-react';
import { HeroBrand } from './hero-brand';
import { HeroJourney } from './hero-journey';
import { LandingAuthOverlay, useLandingAuth } from './landing-auth';

export function LandingPage() {
  const { open, mode, role, created, closeAuth, setMode, setRole, clearRole } =
    useLandingAuth();

  return (
    <div className={`mkt ${open ? 'mkt-auth-open' : ''}`}>
      <section className="mkt-hero" aria-label="BLD">
        <nav className="mkt-nav">
          <div className="mkt-nav-actions">
            {/* Real hrefs: work with soft nav when hydrated, full reload if client JS fails. */}
            <Link href="/?auth=login" className="mkt-nav-btn mkt-nav-btn-ghost" scroll={false}>
              Sign in
            </Link>
            <Link href="/?auth=signup" className="mkt-nav-btn mkt-nav-btn-solid" scroll={false}>
              Create account
            </Link>
          </div>
        </nav>

        <div className="mkt-hero-stage">
          <div className="mkt-hero-media" aria-hidden />
          <div className="mkt-hero-media-veil" aria-hidden />
          <HeroJourney />
          <HeroBrand />
        </div>
      </section>

      <section className="mkt-section" id="get-started">
        <div className="mkt-section-inner">
          <div className="mkt-section-head">
            <span className="mkt-section-eyebrow">Get started</span>
            <h2 className="mkt-section-title">Choose your path</h2>
            <p className="mkt-section-sub">
              Whether you need a survey or deliver them, BLD keeps the process clear, human, and
              reliable.
            </p>
          </div>

          <div className="mkt-paths">
            <Link
              href="/?auth=signup&role=client"
              className="mkt-path mkt-path-client"
              scroll={false}
            >
              <span className="mkt-path-icon" aria-hidden>
                <Building2 size={22} strokeWidth={1.8} />
              </span>
              <span className="mkt-path-tag">For clients</span>
              <h2>Request a survey</h2>
              <p>
                Post your project once. We match you to a vetted surveyor near the site and stay
                with you until the visit is confirmed.
              </p>
              <span className="mkt-path-cta">
                Start as a client
                <span className="mkt-path-arrow" aria-hidden>
                  <ArrowRight size={16} />
                </span>
              </span>
            </Link>

            <Link
              href="/?auth=signup&role=surveyor"
              className="mkt-path mkt-path-surveyor"
              scroll={false}
            >
              <span className="mkt-path-icon" aria-hidden>
                <MapPin size={22} strokeWidth={1.8} />
              </span>
              <span className="mkt-path-tag">For surveyors</span>
              <h2>Offer your services</h2>
              <p>
                Set up your profile and coverage. We bring the right projects to you — no bidding
                wars, no cold outreach.
              </p>
              <span className="mkt-path-cta">
                Start as a surveyor
                <span className="mkt-path-arrow" aria-hidden>
                  <ArrowRight size={16} />
                </span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-section mkt-how">
        <div className="mkt-section-inner">
          <div className="mkt-section-head mkt-section-head-row">
            <div>
              <span className="mkt-section-eyebrow">Simple by design</span>
              <h2 className="mkt-section-title">How it works</h2>
            </div>
            <p className="mkt-section-sub">Three clear steps from request to results.</p>
          </div>
          <div className="mkt-steps">
            <div className="mkt-step">
              <div className="mkt-step-marker">
                <span>01</span>
                <ClipboardCheck size={18} />
              </div>
              <div className="mkt-step-copy">
                <h3>Tell us what you need</h3>
                <p>Share the site, services, and timing in a short project brief.</p>
              </div>
            </div>
            <div className="mkt-step">
              <div className="mkt-step-marker">
                <span>02</span>
                <UserRoundSearch size={18} />
              </div>
              <div className="mkt-step-copy">
                <h3>We match by hand</h3>
                <p>Our team selects a surveyor who fits the location and scope.</p>
              </div>
            </div>
            <div className="mkt-step">
              <div className="mkt-step-marker">
                <span>03</span>
                <MapPin size={18} />
              </div>
              <div className="mkt-step-copy">
                <h3>Survey delivered</h3>
                <p>Your surveyor coordinates the visit and delivers the results.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="mkt-footer">
        <span>© {new Date().getFullYear()} BLD</span>
        <span>Clients &amp; surveyors · Site surveys</span>
      </footer>

      <LandingAuthOverlay
        open={open}
        mode={mode}
        role={role}
        created={created}
        onClose={closeAuth}
        onModeChange={setMode}
        onRoleChange={setRole}
        onClearRole={clearRole}
      />
    </div>
  );
}
