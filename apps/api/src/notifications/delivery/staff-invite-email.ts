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
 * Branded staff invite with Access portal CTA.
 * Link is valid for 3 days and redeemable Monday–Friday only.
 */
export function buildStaffInviteEmail(input: {
  fullName: string;
  email: string;
  tempPassword: string;
  portalUrl: string;
  expiresAt: Date;
}): StaffInviteEmailContent {
  const name = firstName(input.fullName);
  const expiresLabel = input.expiresAt.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const subject = 'Your BLD staff portal access';

  const text = [
    `Hi ${name},`,
    '',
    'You have been invited to the BLD operations staff portal.',
    '',
    `Work email: ${input.email}`,
    `Temporary password: ${input.tempPassword}`,
    '',
    `Open the portal (valid until ${expiresLabel}, Monday–Friday only):`,
    input.portalUrl,
    '',
    'After you sign in, change your password with your super admin if needed.',
    '',
    '— BLD',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BLD staff invite</title></head>
<body style="margin:0;padding:0;background:#f4f2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2a2558;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ff;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid rgba(113,104,246,0.16);overflow:hidden;">
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7168f6;">Staff invite</p>
          <h1 style="margin:0 0 10px;font-size:22px;letter-spacing:-0.02em;">Welcome to BLD operations</h1>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#6b668c;">Hi ${escapeHtml(name)}, you&rsquo;ve been invited to the staff portal. Use the button below — the link is valid until <strong style="color:#2a2558;">${escapeHtml(expiresLabel)}</strong> and can only be opened <strong style="color:#2a2558;">Monday–Friday</strong>.</p>
          <p style="margin:0 0 6px;font-size:13px;color:#6b668c;"><strong style="color:#2a2558;">Email:</strong> ${escapeHtml(input.email)}</p>
          <p style="margin:0 0 22px;font-size:13px;color:#6b668c;"><strong style="color:#2a2558;">Temp password:</strong> ${escapeHtml(input.tempPassword)}</p>
          <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#7168f6;color:#ffffff;font-size:14px;font-weight:700;">Access portal</a>
          <p style="margin:18px 0 0;font-size:12px;line-height:1.45;color:#8a84a8;">If the button doesn&rsquo;t work, paste this link into your browser:<br>${escapeHtml(input.portalUrl)}</p>
        </td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#8a84a8;">— BLD</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
