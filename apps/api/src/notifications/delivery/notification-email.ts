export interface NotificationEmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface NotificationEmailInput {
  subject: string;
  /** Inbox preview line; defaults to `intro`. */
  preheader?: string;
  /** HTML entity for the hero tile, e.g. `&#129309;`. */
  icon: string;
  /** Small pill above the heading, e.g. "Match found". */
  badge?: string;
  heading: string;
  /** Short line under the heading in the hero. */
  intro: string;
  /** Recipient name for the "Hi {first}," greeting; omitted for ops mail. */
  fullName?: string | null;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  /** User-written text (ticket reply, feedback comment) shown as a quote. */
  quote?: string;
  cta: { label: string; url: string };
  /** Muted info box under the button. */
  note?: string;
  /** Footer line explaining why the recipient got this email. */
  footerReason?: string;
}

function firstName(fullName: string | null | undefined): string | null {
  const part = (fullName ?? '').trim().split(/\s+/)[0];
  return part || null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

/**
 * Branded transactional email (same shell as reset-password / welcome):
 * brand mark, gradient hero with icon + heading, greeting, details card, CTA, help footer.
 */
export function buildNotificationEmail(input: NotificationEmailInput): NotificationEmailContent {
  const name = firstName(input.fullName);
  const details = (input.details ?? []).filter((d) => d.value.trim());
  const year = String(new Date().getFullYear());
  const footerReason =
    input.footerReason ?? 'You’re receiving this because you have an account with BLD.';

  const text = [
    ...(name ? [`Hi ${name},`, ''] : []),
    ...input.paragraphs.flatMap((p) => [p, '']),
    ...(details.length ? [...details.map((d) => `${d.label}: ${d.value}`), ''] : []),
    ...(input.quote ? [input.quote.trim(), ''] : []),
    `${input.cta.label}: ${input.cta.url}`,
    '',
    ...(input.note ? [input.note, ''] : []),
    'Need help? Reach us at support@bld.online.',
    '',
    '— BLD',
  ].join('\n');

  const badge = input.badge
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                      <tr>
                        <td style="padding:7px 16px; background-color:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.34); border-radius:100px; font-family:'Inter',Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#FFFFFF;">
                          &#9679;&nbsp; ${escapeHtml(input.badge)}
                        </td>
                      </tr>
                    </table>`
    : '';

  const greeting = name
    ? `<p style="margin:0 0 16px 0; font-family:'Inter',Arial,sans-serif; font-size:16px; line-height:25px; color:#6B668C;">Hi <strong style="color:#2A2558;">${escapeHtml(name)}</strong>,</p>`
    : '';

  const paragraphs = input.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0; font-family:'Inter',Arial,sans-serif; font-size:16px; line-height:25px; color:#6B668C;">${nl2br(p)}</p>`,
    )
    .join('\n                    ');

  const detailRows = details
    .map(
      (d, i) => `<tr>
                        <td style="padding:${i === 0 ? '16px' : '10px'} 18px ${i === details.length - 1 ? '16px' : '0'} 18px; font-family:'Inter',Arial,sans-serif; font-size:13px; line-height:20px; color:#6B668C; width:38%; vertical-align:top;">${escapeHtml(d.label)}</td>
                        <td style="padding:${i === 0 ? '16px' : '10px'} 18px ${i === details.length - 1 ? '16px' : '0'} 0; font-family:'Inter',Arial,sans-serif; font-size:14px; line-height:20px; font-weight:600; color:#2A2558; vertical-align:top;">${nl2br(d.value)}</td>
                      </tr>`,
    )
    .join('\n                      ');

  const detailsCard = details.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0; background-color:#F7F8FF; border:1px solid rgba(91,82,224,0.12); border-radius:14px;">
                      ${detailRows}
                    </table>`
    : '';

  const quote = input.quote?.trim()
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                      <tr>
                        <td style="padding:14px 18px; border-left:4px solid #7168F6; background-color:#FBFBFF; border-radius:0 12px 12px 0; font-family:'Inter',Arial,sans-serif; font-size:14px; line-height:22px; color:#2A2558;">${nl2br(input.quote.trim())}</td>
                      </tr>
                    </table>`
    : '';

  const note = input.note
    ? `<tr>
                  <td class="px" style="padding:24px 44px 8px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FF; border:1px solid rgba(91,82,224,0.12); border-radius:14px;">
                      <tr>
                        <td style="padding:14px 18px; font-family:'Inter',Arial,sans-serif; font-size:13px; line-height:20px; color:#6B668C;">${nl2br(input.note)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(input.subject)}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100%!important; height:100%!important; }
  a { text-decoration:none; }
  @media screen and (max-width:620px) {
    .container { width:100%!important; }
    .px { padding-left:24px!important; padding-right:24px!important; }
    .hero-pad { padding:38px 26px 40px 26px!important; }
    .btn-pad { padding:14px 28px!important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FF; font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F7F8FF;">
    ${escapeHtml(input.preheader ?? input.intro)} &#8203;&zwnj;&nbsp;
  </div>

  <center style="width:100%; background-color:#F7F8FF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F8FF; background:linear-gradient(180deg,#EEEAFF 0%,#F7F8FF 260px);">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <span style="font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:24px; letter-spacing:-0.02em; color:#2A2558;">BLD</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 20px 48px rgba(42,37,88,0.14);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td class="hero-pad" align="center" bgcolor="#5B52E0" style="padding:44px 44px 40px 44px; background:#5B52E0; background:linear-gradient(135deg,#4A42C9 0%,#5B52E0 35%,#7168F6 65%,#9B94FF 100%);">
                    ${badge}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                      <tr>
                        <td style="width:64px; height:64px; background:#EEEAFF; background:linear-gradient(135deg,#EEEAFF 0%,#A29BFF 100%); border-radius:18px; text-align:center; vertical-align:middle; box-shadow:0 10px 24px rgba(42,37,88,0.28);">
                          <span style="font-size:30px; line-height:64px;">${input.icon}</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0; font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:26px; line-height:32px; letter-spacing:-0.02em; color:#FFFFFF;">
                      ${escapeHtml(input.heading)}
                    </h1>
                    <p style="margin:12px auto 0 auto; max-width:400px; font-family:'Inter',Arial,sans-serif; font-size:15px; line-height:23px; color:#EEEAFF;">
                      ${escapeHtml(input.intro)}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:36px 44px 8px 44px;">
                    ${greeting}
                    ${paragraphs}
                    ${detailsCard}
                    ${quote}
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 8px auto;">
                      <tr>
                        <td align="center" bgcolor="#5B52E0" style="border-radius:12px; background:#5B52E0;">
                          <a class="btn-pad" href="${escapeHtml(input.cta.url)}" target="_blank" style="display:inline-block; padding:16px 36px; font-family:'Inter',Arial,sans-serif; font-size:15px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                            ${escapeHtml(input.cta.label)} &nbsp;&rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${note}

                <tr>
                  <td class="px" style="padding:24px 44px 40px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(91,82,224,0.12);">
                      <tr><td style="height:22px; font-size:0; line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td align="center" style="font-family:'Inter',Arial,sans-serif;">
                          <p style="margin:0; font-size:13.5px; line-height:21px; color:#6B668C;">
                            Need help? Reach us at
                            <a href="mailto:support@bld.online" style="color:#7168F6; font-weight:600;">support@bld.online</a>.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 30px 8px 30px; font-family:'Inter',Arial,sans-serif;">
              <p style="margin:0 0 8px 0; font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:15px; color:#2A2558;">BLD</p>
              <p style="margin:0 0 10px 0; font-size:12px; line-height:18px; color:#6B668C;">
                The managed marketplace connecting clients with independent site surveyors.
              </p>
              <p style="margin:0 0 14px 0; font-size:11.5px; line-height:17px; color:#9B94FF;">${escapeHtml(footerReason)}</p>
              <p style="margin:0; font-size:11px; color:#9B94FF;">&copy; ${year} BLD. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  </center>
</body>
</html>
`;

  return { subject: input.subject, text, html };
}
