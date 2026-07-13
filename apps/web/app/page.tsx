import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mkt">
      <section className="mkt-hero" aria-label="SurveyLink">
        <div className="mkt-hero-media" aria-hidden />

        <nav className="mkt-nav">
          <Link href="/" className="mkt-brand">
            <span className="mkt-brand-mark">
              <Compass size={18} strokeWidth={2.4} />
            </span>
            SurveyLink
          </Link>
          <div className="mkt-nav-actions">
            <Link className="mkt-link" href="/login">
              Sign in
            </Link>
            <Link className="mkt-btn mkt-btn-light" href="/signup">
              Get started
            </Link>
          </div>
        </nav>

        <div className="mkt-hero-copy">
          <h1 className="mkt-display">Site surveys, matched with care.</h1>
          <p className="mkt-lede">
            The managed marketplace for clients who need a survey and independent surveyors ready
            to deliver — coordinated by our team.
          </p>
          <div className="mkt-cta-row">
            <Link className="mkt-btn mkt-btn-light" href="/signup">
              Create an account <ArrowRight size={17} />
            </Link>
            <Link className="mkt-btn mkt-btn-ghost" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="mkt-section" id="get-started">
        <div className="mkt-section-inner">
          <h2 className="mkt-section-title">Choose your path</h2>
          <p className="mkt-section-sub">
            Whether you need a survey or deliver them, SurveyLink keeps the process clear, human,
            and reliable.
          </p>

          <div className="mkt-paths">
            <Link href="/signup?role=client" className="mkt-path">
              <span className="mkt-path-tag">Clients</span>
              <h2>Request a survey</h2>
              <p>
                Post your project once. We match you to a vetted surveyor near the site and stay
                with you until the visit is confirmed.
              </p>
              <span className="mkt-path-cta">
                Start as a client <ArrowRight size={16} />
              </span>
            </Link>

            <Link href="/signup?role=surveyor" className="mkt-path">
              <span className="mkt-path-tag">Surveyors</span>
              <h2>Offer your services</h2>
              <p>
                Set up your profile and coverage. We bring the right projects to you — no bidding
                wars, no cold outreach.
              </p>
              <span className="mkt-path-cta">
                Start as a surveyor <ArrowRight size={16} />
              </span>
            </Link>
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
        <span>© {new Date().getFullYear()} SurveyLink</span>
        <span>Clients &amp; surveyors · Managed matching</span>
      </footer>
    </div>
  );
}
