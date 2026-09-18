/**
 * One-off: build the branded welcome HTML and send via SendGrid.
 * Run after `pnpm --filter @surveylink/api build`.
 *
 *   TO_EMAIL=you@example.com FULL_NAME=Neeyal ROLE=client \
 *   SENDGRID_API_KEY=SG.... TWILIO_EMAIL_FROM=noreply@bld.online \
 *   WEB_APP_URL=https://staging.bld.online \
 *   node scripts/send-welcome-email.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildWelcomeEmail } = require('../apps/api/dist/notifications/delivery/welcome-email.js');

const to = (process.env.TO_EMAIL || '').trim();
const fullName = (process.env.FULL_NAME || 'there').trim();
const role = (process.env.ROLE || 'client').trim() === 'surveyor' ? 'surveyor' : 'client';
const appUrl = (process.env.WEB_APP_URL || 'https://staging.bld.online').trim();
const key = (process.env.SENDGRID_API_KEY || '').trim();
const from = (process.env.TWILIO_EMAIL_FROM || '').trim();
const fromName = (process.env.TWILIO_EMAIL_FROM_NAME || 'BLD').trim();

if (!to || !key || !from) {
  console.error('Need TO_EMAIL, SENDGRID_API_KEY, TWILIO_EMAIL_FROM');
  process.exit(1);
}

const content = buildWelcomeEmail({ fullName, role, appUrl });
const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: fromName },
    subject: content.subject,
    content: [
      { type: 'text/plain', value: content.text },
      { type: 'text/html', value: content.html },
    ],
    categories: ['welcome'],
  }),
});

const body = await res.text();
console.log(`SendGrid HTTP ${res.status}`);
if (body) console.log(body.slice(0, 800));
if (!res.ok) process.exit(1);
console.log(`Sent welcome to ${to} (${role})`);
