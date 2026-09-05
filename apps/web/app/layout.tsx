import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DM_Sans, Fraunces } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BLD',
  description:
    'BLD is a managed marketplace connecting clients with independent site surveyors.',
};

// viewportFit: 'cover' is what makes env(safe-area-inset-*) resolve on notched
// iPhones; without it those insets are always 0 and sticky bars sit under the
// home indicator.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Client-heavy app (auth/session); skip SSG prerender that breaks under monorepo React.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) mutate
          <body> before hydration; ignore those attribute-only mismatches. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
