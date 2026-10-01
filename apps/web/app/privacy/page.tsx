import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Privacy Policy · BLD',
  description: 'How Virtual Building Studio collects, uses and protects your data on BLD.',
};

const LAST_UPDATED = 'October 1, 2026';

const textStyle = { color: 'var(--muted)', fontSize: 14, lineHeight: 1.65 } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="auth-shell">
      <article className="auth-card" style={{ maxWidth: 760 }}>
        <div className="auth-panel">
          <p className="kicker" style={{ marginBottom: 4 }}>
            Legal
          </p>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>Privacy Policy</h1>
          <p style={{ ...textStyle, fontSize: 13 }}>Last updated {LAST_UPDATED}</p>

          <div
            role="note"
            style={{
              marginTop: 16,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.22)',
            }}
          >
            <p style={{ ...textStyle, color: 'var(--text)', margin: 0, fontWeight: 600 }}>
              We never sell, rent or share your personal data with third parties for their own use,
              and we don&apos;t show ads.
            </p>
          </div>

          <Section title="Who we are">
            <p style={textStyle}>
              BLD is an application owned and operated by Virtual Building Studio. It connects clients
              with survey professionals for building surveys, laser scanning, BIM and Scan-to-BIM work.
              Virtual Building Studio is responsible for the personal data you provide through the BLD
              website and mobile apps.
            </p>
          </Section>

          <Section title="What we collect">
            <ul style={{ ...textStyle, paddingLeft: 18 }}>
              <li>
                <strong>Account details:</strong> your name, email address, phone number and password
                (handled by our secure sign-in provider and never stored in plain text), and whether you
                use BLD as a client, a surveyor or both.
              </li>
              <li>
                <strong>Profile and portfolio:</strong> company details, services, coverage area,
                rates, equipment, experience and any documents or images you upload.
              </li>
              <li>
                <strong>Projects:</strong> project briefs, site addresses and map locations, building
                details, files and notes you add.
              </li>
              <li>
                <strong>Support and feedback:</strong> help desk tickets, attachments and ratings.
              </li>
              <li>
                <strong>Technical data:</strong> sign-in sessions, basic device and browser details and
                security logs, used to keep your account safe.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <ul style={{ ...textStyle, paddingLeft: 18 }}>
              <li>To create and secure your account, including email and phone verification codes.</li>
              <li>To match client projects with suitable surveyors and run the marketplace.</li>
              <li>To send account, project and match notifications by email, SMS and in the app.</li>
              <li>To answer support requests and improve BLD.</li>
              <li>To prevent fraud and abuse and to meet legal obligations.</li>
            </ul>
          </Section>

          <Section title="Who can see your information">
            <ul style={{ ...textStyle, paddingLeft: 18 }}>
              <li>
                <strong>Other BLD users, only as needed:</strong> a surveyor offered your project sees
                the brief, the site location and your public username or company name. Clients see the
                portfolio of surveyors they browse or are matched with. Your email and phone number are
                not shown to other users.
              </li>
              <li>
                <strong>Virtual Building Studio staff:</strong> authorized team members can access data
                to provide support and operate the platform.
              </li>
            </ul>
          </Section>

          <Section title="No sharing with third parties">
            <p style={textStyle}>
              We do not sell, rent, trade or share your personal data with third parties for marketing,
              advertising or any purpose of their own. To run BLD we rely on a small number of service
              providers that process data only on our behalf and under our instructions: cloud hosting
              and file storage, sign-in, email and SMS delivery, error monitoring, and maps and address
              lookup. They are not allowed to use your data for anything else.
            </p>
            <p style={textStyle}>
              We will only disclose information if the law requires it, for example in response to a
              valid court order.
            </p>
          </Section>

          <Section title="How we protect it">
            <p style={textStyle}>
              All traffic is encrypted with HTTPS. Passwords are never stored in plain text, web sessions
              use secure httpOnly cookies, and the mobile app keeps sign-in tokens in the device&apos;s
              secure storage. Access to personal data inside Virtual Building Studio is limited to staff
              who need it.
            </p>
          </Section>

          <Section title="Your choices">
            <p style={textStyle}>
              You can view and update your profile at any time in the app. You can ask us for a copy of
              your data, to correct it, or to delete your account and associated personal data by opening
              a help desk ticket or emailing{' '}
              <a href="mailto:support@bld.online?subject=Privacy%20request">support@bld.online</a>. We
              keep data only for as long as your account is active or as required by law.
            </p>
          </Section>

          <Section title="Contact">
            <p style={textStyle}>
              Questions about privacy? Email{' '}
              <a href="mailto:support@bld.online">support@bld.online</a>.
            </p>
          </Section>
        </div>
      </article>
    </main>
  );
}
