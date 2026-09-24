import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { AppToasts } from '../components/app-toasts';

/** Recommended product stack: Satoshi (display) + Inter (UI/body). */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const satoshi = localFont({
  src: [
    {
      path: '../public/fonts/satoshi/Satoshi-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/satoshi/Satoshi-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/satoshi/Satoshi-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
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
    <html lang="en" className={`${inter.variable} ${satoshi.variable}`}>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) mutate
          <body> before hydration; ignore those attribute-only mismatches. */}
      <body suppressHydrationWarning>
        {children}
        <AppToasts />
      </body>
    </html>
  );
}
