import type { MembershipRole } from '@surveylink/types';

export interface WelcomeEmailContent {
  subject: string;
  text: string;
  html: string;
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || 'there';
}

function roleLabel(role: MembershipRole): string {
  if (role === 'surveyor') return 'Surveyor';
  if (role === 'client') return 'Client';
  return role;
}

function roleBlurb(role: MembershipRole): string {
  if (role === 'surveyor') {
    return 'Complete a few quick steps, then build your portfolio so the right projects can find you.';
  }
  if (role === 'client') {
    return 'Complete a few quick steps, then you can post projects and get matched with vetted surveyors.';
  }
  return 'Complete a few quick steps to unlock your workspace.';
}

/**
 * Warm, professional welcome message after Create account.
 * Inline styles for reliable rendering across mail clients.
 */
export function buildWelcomeEmail(input: {
  fullName: string;
  role: MembershipRole;
  appUrl: string;
}): WelcomeEmailContent {
  const name = firstName(input.fullName);
  const label = roleLabel(input.role);
  const blurb = roleBlurb(input.role);
  const continueUrl = `${input.appUrl.replace(/\/$/, '')}/onboarding`;

  const subject = `Welcome to BLD, ${name}`;

  const text = [
    `Hello ${name},`,
    '',
    `Welcome to BLD — we're glad you're here.`,
    '',
    `Your ${label} account is set up. ${blurb}`,
    '',
    `Continue setup: ${continueUrl}`,
    '',
    'If you did not create this account, you can ignore this message.',
    '',
    'Warm regards,',
    'The BLD team',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf2;">
          <tr>
            <td style="background:#0b1f3a;padding:28px 32px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9fb4d9;">BLD</p>
              <h1 style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;font-weight:400;color:#ffffff;">Welcome aboard</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:17px;line-height:1.5;color:#1a2332;">Hello ${escapeHtml(name)},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
                Welcome to BLD — we're glad you're here.
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">
                Your <strong style="color:#0b1f3a;">${escapeHtml(label)}</strong> account is ready.
                ${escapeHtml(blurb)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
                <tr>
                  <td style="border-radius:8px;background:#0b1f3a;">
                    <a href="${escapeHtml(continueUrl)}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Continue account setup
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
                Or paste this link into your browser:<br />
                <a href="${escapeHtml(continueUrl)}" style="color:#0b1f3a;word-break:break-all;">${escapeHtml(continueUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">
                Warm regards,<br />
                <strong style="color:#0b1f3a;">The BLD team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e6ebf2;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;">
                If you did not create a BLD account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
