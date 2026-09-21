export interface StaffInviteEmailContent {
  subject: string;
  text: string;
  html: string;
}

function firstName(fullName: string | null | undefined): string {
  const part = (fullName ?? '').trim().split(/\s+/)[0];
  return part || 'there';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Branded staff invite — Access portal CTA only.
 * Credentials are never shown; the portal link prefills them server-side.
 * TTL / weekday rules are enforced by the API, not mentioned in copy.
 */
export function buildStaffInviteEmail(input: {
  fullName: string;
  portalUrl: string;
}): StaffInviteEmailContent {
  const name = firstName(input.fullName);
  const subject = 'You\'re invited to BLD operations';

  const text = [
    `Hi ${name},`,
    '',
    'You have been invited to the BLD operations portal.',
    '',
    'Open the portal to get started:',
    input.portalUrl,
    '',
    '— BLD',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>BLD staff invite</title>
</head>
<body style="margin:0;padding:0;background:#ebe8ff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ebe8ff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(42,37,88,0.08);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#7168f6 0%,#9b93ff 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:36px 36px 8px;text-align:center;">
              <p style="margin:0 0 18px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7168f6;">Staff invite</p>
              <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;letter-spacing:-0.03em;color:#1e1a3a;font-weight:700;">Welcome to BLD operations</h1>
              <p style="margin:0 auto;max-width:340px;font-size:15px;line-height:1.55;color:#6b668c;">
                Hi ${escapeHtml(name)}, you&rsquo;ve been invited to the staff portal. Use the button below to continue.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 36px 36px;">
              <a href="${escapeHtml(input.portalUrl)}"
                 style="display:inline-block;padding:14px 28px;border-radius:12px;background:#7168f6;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">
                Access portal
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px;text-align:center;border-top:1px solid rgba(113,104,246,0.1);">
              <p style="margin:20px 0 0;font-size:12px;line-height:1.45;color:#9a94b8;">— BLD</p>
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
