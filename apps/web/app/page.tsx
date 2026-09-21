import { Suspense } from 'react';
import '../app/landing.css';
import { LandingPage } from '../components/landing-page';

export default function HomePage() {
  return (
    <>
      {/* LCP hero: start download before client JS; one asset per viewport */}
      <link
        rel="preload"
        as="image"
        href="/brand/landing-hero-mobile-portrait.webp"
        type="image/webp"
        media="(max-width: 768px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/brand/landing-hero-mobile.webp"
        type="image/webp"
        media="(min-width: 769px) and (max-width: 1024px)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href="/brand/landing-hero.webp"
        type="image/webp"
        media="(min-width: 1025px)"
        fetchPriority="high"
      />
      <Suspense
        fallback={
          <div className="bld-landing">
            <nav className="bld-nav" aria-label="Main">
              <div className="bld-nav-inner">
                <span className="bld-nav-logo" aria-label="BLD" />
              </div>
            </nav>
          </div>
        }
      >
        <LandingPage />
      </Suspense>
    </>
  );
}
