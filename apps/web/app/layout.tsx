import type { Metadata } from 'next';
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable}`}>
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) mutate
          <body> before hydration; ignore those attribute-only mismatches. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
