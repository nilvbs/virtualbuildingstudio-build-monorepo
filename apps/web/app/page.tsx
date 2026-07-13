import { Suspense } from 'react';
import { LandingPage } from '../components/landing-page';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="mkt">
          <section className="mkt-hero" aria-label="BLD" />
        </div>
      }
    >
      <LandingPage />
    </Suspense>
  );
}
