'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  Mountain,
  Plane,
  Radar,
} from 'lucide-react';
import { LandingAuthOverlay, useLandingAuth } from './landing-auth';
import { LandingFlow } from './landing-flow';

const LandingPresenceMap = dynamic(
  () => import('./landing-presence-map').then((m) => m.LandingPresenceMap),
  {
    ssr: false,
    loading: () => <div className="bld-presence-frame bld-presence-frame--loading">Loading map…</div>,
  },
);

const HERO_IMAGE_DESKTOP = '/brand/landing-hero.png';
const HERO_IMAGE_TABLET = '/brand/landing-hero-mobile.png';
const HERO_IMAGE_MOBILE = '/brand/landing-hero-mobile-portrait.png?v=3';

const PATH_IMAGES = {
  client: '/brand/path-client.png?v=3',
  surveyor: '/brand/path-surveyor.png?v=3',
} as const;

const SERVICES = [
  {
    icon: Radar,
    title: 'Laser Scanning',
    body: 'Millimeter-accurate 3D point clouds of buildings and sites — ready for design and BIM.',
    demand: 'Most requested',
  },
  {
    icon: Plane,
    title: 'Drone Surveys',
    body: 'Aerial photogrammetry and LiDAR for fast, large-area documentation from above.',
    demand: 'Rising fast',
  },
  {
    icon: Mountain,
    title: 'Topographic',
    body: 'Clear maps of terrain and features for planning, grading, and site design.',
    demand: 'Always in demand',
  },
] as const;

export function LandingPage() {
  const { open, mode, role, created, closeAuth, setMode, setRole, clearRole } =
    useLandingAuth();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous =
      'scrollRestoration' in history ? history.scrollRestoration : undefined;
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const jumpToTop = () => {
      window.scrollTo(0, 0);
    };

    jumpToTop();
    // Browsers may restore scroll after paint — force again on next frames.
    const frame = window.requestAnimationFrame(() => {
      jumpToTop();
      window.requestAnimationFrame(jumpToTop);
    });

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) jumpToTop();
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pageshow', onPageShow);
      if ('scrollRestoration' in history && previous) {
        history.scrollRestoration = previous;
      }
    };
  }, []);

  useEffect(() => {
    const reveals = document.querySelectorAll('.bld-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('bld-reveal--active');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    reveals.forEach((el) => observer.observe(el));

    const onScroll = () => {
      navRef.current?.classList.toggle('bld-nav--scrolled', window.scrollY > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className={`bld-landing mkt ${open ? 'mkt-auth-open' : ''}`}>
      <main>
        <section className="bld-hero" aria-label="Introduction">
          <div className="bld-hero-bg-wrap" aria-hidden>
            <img
              src={HERO_IMAGE_MOBILE}
              alt=""
              className="bld-hero-bg bld-hero-bg--mobile"
              loading="eager"
              decoding="async"
            />
            <img
              src={HERO_IMAGE_TABLET}
              alt=""
              className="bld-hero-bg bld-hero-bg--tablet"
              loading="lazy"
              decoding="async"
            />
            <img
              src={HERO_IMAGE_DESKTOP}
              alt=""
              className="bld-hero-bg bld-hero-bg--desktop"
              loading="eager"
              decoding="async"
            />
          </div>

          <div className="bld-hero-stage">
            <div className="bld-hero-head">
              <div className="bld-hero-header">
                <Link href="/" className="bld-hero-logo" scroll={false} aria-label="BLD home">
                  <img
                    src="/brand/bld-logo-dark.png"
                    alt="BLD"
                    className="bld-hero-logo-img"
                    width={636}
                    height={236}
                  />
                </Link>

                <nav ref={navRef} className="bld-nav" aria-label="Main">
                  <div className="bld-nav-inner">
                    <div className="bld-nav-actions">
                      <Link href="/?auth=login" className="bld-nav-signin" scroll={false}>
                        Sign In
                      </Link>
                      <Link href="/?auth=signup" className="bld-nav-cta" scroll={false}>
                        Create Account
                      </Link>
                    </div>
                  </div>
                </nav>
              </div>

              <div className="bld-hero-tagline-wrap bld-animate bld-animate--1">
                <p className="bld-hero-tagline">
                  The right surveyor for your site —{' '}
                  <span className="bld-hero-tagline-accent">matched by hand</span>
                </p>
              </div>
            </div>

            <div className="bld-hero-foot">
              <div className="bld-hero-actions bld-animate bld-animate--3">
                <Link
                  href="/?auth=signup&role=client"
                  className="bld-btn bld-btn--primary"
                  scroll={false}
                >
                  Find my surveyor
                  <ArrowRight className="bld-hero-btn-icon" size={23} strokeWidth={2} aria-hidden />
                </Link>
                <Link
                  href="/?auth=signup&role=surveyor"
                  className="bld-btn bld-btn--outline"
                  scroll={false}
                >
                  Join as a surveyor
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="bld-path bld-reveal"
          aria-labelledby="bld-path-title"
        >
          <div className="bld-container">
            <div className="bld-section-head bld-path-head">
              <h2 id="bld-path-title" className="bld-section-title">
                Choose your path
              </h2>
              <p className="bld-section-sub">
                Need a survey — or ready to deliver one? Get matched by hand.
              </p>
            </div>

            <div className="bld-path-grid">
              <Link
                href="/?auth=signup&role=client"
                className="bld-path-card bld-path-card--client"
                scroll={false}
              >
                <div className="bld-path-media" aria-hidden>
                  <img src={PATH_IMAGES.client} alt="" loading="lazy" />
                  <div className="bld-path-media-veil" />
                  <div className="bld-path-badge">
                    <Building2 size={16} strokeWidth={2.25} />
                    For clients
                  </div>
                </div>
                <div className="bld-path-body">
                  <h3>Request a survey</h3>
                  <p>
                    Share your site once. We hand-match vetted surveyors to your property —
                    clear scope, no bidding wars.
                  </p>
                  <ul className="bld-path-trust">
                    <li>
                      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                      Hand-matched specialists
                    </li>
                    <li>
                      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                      Dedicated client workspace
                    </li>
                    <li>
                      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                      Supported until the visit is confirmed
                    </li>
                  </ul>
                  <span className="bld-path-cta">
                    Get started
                    <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
                  </span>
                </div>
              </Link>

              <Link
                id="for-surveyors"
                href="/?auth=signup&role=surveyor"
                className="bld-path-card bld-path-card--surveyor"
                scroll={false}
              >
                <div className="bld-path-media" aria-hidden>
                  <img src={PATH_IMAGES.surveyor} alt="" loading="lazy" />
                  <div className="bld-path-media-veil" />
                  <div className="bld-path-badge">
                    <Compass size={16} strokeWidth={2.25} />
                    For surveyors
                  </div>
                </div>
                <div className="bld-path-body">
                  <h3>Offer your services</h3>
                  <p>
                    Join the vetted network, set coverage and kit, and get matched to premium
                    site surveys that fit your expertise.
                  </p>
                  <ul className="bld-path-trust">
                    <li>
                      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                      Matched on location &amp; kit
                    </li>
                    <li>
                      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                      Portfolio &amp; coverage tools
                    </li>
                    <li>
                      <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                      Dedicated surveyor workspace
                    </li>
                  </ul>
                  <span className="bld-path-cta">
                    Apply to join
                    <ArrowRight size={18} strokeWidth={2.25} aria-hidden />
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section
          id="coverage"
          className="bld-presence bld-reveal"
          aria-labelledby="bld-presence-title"
        >
          <div className="bld-container">
            <div className="bld-section-head bld-presence-head">
              <h2 id="bld-presence-title" className="bld-section-title">
                Surveyors across the U.S.
              </h2>
              <p className="bld-section-sub bld-presence-sub">
                A vetted network coast to coast — matched to specialists who already cover your region.
              </p>
            </div>

            <LandingPresenceMap />
          </div>
        </section>

        <section
          id="flow"
          className="bld-flow bld-reveal"
          aria-labelledby="bld-flow-title"
        >
          <div className="bld-container">
            <LandingFlow />
          </div>
        </section>

        <section
          id="services"
          className="bld-services bld-reveal"
          aria-labelledby="bld-services-title"
        >
          <div className="bld-container">
            <div className="bld-section-head bld-services-head">
              <h2 id="bld-services-title" className="bld-section-title">
                What’s requested most
              </h2>
              <p className="bld-section-sub">
                The surveys clients ask for — and surveyors deliver — again and again.
              </p>
            </div>

            <div className="bld-services-grid">
              {SERVICES.map(({ icon: Icon, title, body, demand }, index) => (
                <article key={title} className="bld-service-card">
                  <div className="bld-service-top">
                    <div className="bld-service-icon" aria-hidden>
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    <span className="bld-service-demand">{demand}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <span className="bld-service-rank" aria-hidden>
                    #{index + 1} most matched
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bld-footer bld-reveal">
        <div className="bld-container">
          <div className="bld-footer-grid">
            <div className="bld-footer-brand">
              <Link href="/" className="bld-footer-logo-link" scroll={false} aria-label="BLD home">
                <img
                  src="/brand/bld-logo-dark.png"
                  alt="BLD"
                  className="bld-footer-logo-img"
                  width={636}
                  height={236}
                />
              </Link>
              <p>The managed marketplace for site surveys — matched by hand.</p>
            </div>
            <div className="bld-footer-col">
              <h4>Platform</h4>
              <a href="#how-it-works">How it works</a>
              <a href="#coverage">Coverage</a>
              <a href="#flow">Matching flow</a>
              <a href="#for-surveyors">For surveyors</a>
              <a href="#services">Services</a>
            </div>
            <div className="bld-footer-col">
              <h4>Get started</h4>
              <Link href="/?auth=signup&role=client" scroll={false}>
                Request a survey
              </Link>
              <Link href="/?auth=signup&role=surveyor" scroll={false}>
                Offer your services
              </Link>
              <Link href="/?auth=login" scroll={false}>
                Sign in
              </Link>
            </div>
          </div>
          <div className="bld-footer-bottom">
            <p className="bld-footer-copy">
              © {new Date().getFullYear()} BLD. All rights reserved.
            </p>
            <div className="bld-footer-legal">
              <a href="#">Terms</a>
              <a href="#">Privacy</a>
              <a href="#">Support</a>
            </div>
          </div>
        </div>
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
