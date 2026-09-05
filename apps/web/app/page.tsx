import { Suspense } from 'react';
import '../app/landing.css';
import { LandingPage } from '../components/landing-page';

export default function HomePage() {
  return (
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
  );
}
