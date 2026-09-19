export interface ResetPasswordEmailContent {
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

function fill(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

/**
 * Branded password-reset email with a one-click action link (1 hour TTL).
 */
export function buildResetPasswordEmail(input: {
  fullName?: string | null;
  resetUrl: string;
  expiresInMinutes?: number;
}): ResetPasswordEmailContent {
  const name = firstName(input.fullName);
  const minutes = input.expiresInMinutes ?? 60;
  const year = String(new Date().getFullYear());
  const subject = 'Reset your BLD password';

  const text = [
    `Hi ${name},`,
    '',
    'We received a request to reset the password for your BLD account.',
    `Open this link to choose a new password (expires in ${minutes} minutes):`,
    input.resetUrl,
    '',
    'If you did not request this, you can ignore this email — your password will stay the same.',
    '',
    'Need help? Reach us at support@bld.online.',
    '',
    '— BLD',
  ].join('\n');

  const html = fill(RESET_PASSWORD_HTML, {
    first_name: escapeHtml(name),
    reset_url: escapeHtml(input.resetUrl),
    expires_minutes: String(minutes),
    current_year: year,
  });

  return { subject, text, html };
}

const RESET_PASSWORD_HTML = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reset your BLD password</title>
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
<body style="margin:0; padding:0; background-color:#F7F8FF; font-family:'DM Sans','Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F7F8FF;">
    Reset your BLD password — this link expires in {{expires_minutes}} minutes. &#8203;&zwnj;&nbsp;
  </div>

  <center style="width:100%; background-color:#F7F8FF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F8FF; background:linear-gradient(180deg,#EEEAFF 0%,#F7F8FF 260px);">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px; max-width:560px;">

          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <span style="font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:24px; letter-spacing:-0.02em; color:#2A2558;">BLD</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 20px 48px rgba(42,37,88,0.14);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td class="hero-pad" align="center" style="padding:44px 44px 40px 44px; background:#7168F6; background:linear-gradient(135deg,#4A42C9 0%,#5B52E0 35%,#7168F6 65%,#9B94FF 100%);">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                      <tr>
                        <td style="width:64px; height:64px; background:linear-gradient(135deg,#EEEAFF 0%,#A29BFF 100%); border-radius:18px; text-align:center; vertical-align:middle; box-shadow:0 10px 24px rgba(42,37,88,0.28);">
                          <span style="font-size:30px; line-height:64px;">&#128273;</span>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:26px; line-height:32px; letter-spacing:-0.02em; color:#FFFFFF;">
                      Reset your password
                    </h1>
                    <p style="margin:12px auto 0 auto; max-width:400px; font-family:'DM Sans',Arial,sans-serif; font-size:15px; line-height:23px; color:#EEEAFF;">
                      Choose a new password for your BLD account. This link is unique to you.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:36px 44px 8px 44px;">
                    <p style="margin:0 0 28px 0; font-family:'DM Sans',Arial,sans-serif; font-size:16px; line-height:25px; color:#6B668C;">
                      Hi <strong style="color:#2A2558;">{{first_name}}</strong>, we received a request to reset your password.
                      Click the button below to continue &mdash; the link expires in <strong style="color:#2A2558;">{{expires_minutes}} minutes</strong>.
                    </p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 8px auto;">
                      <tr>
                        <td align="center" bgcolor="#5B52E0" style="border-radius:12px; background:#5B52E0;">
                          <a class="btn-pad" href="{{reset_url}}" target="_blank" style="display:inline-block; padding:16px 36px; font-family:'DM Sans',Arial,sans-serif; font-size:15px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:12px;">
                            Set new password
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:28px 44px 8px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FF; border:1px solid rgba(91,82,224,0.12); border-radius:14px;">
                      <tr>
                        <td style="padding:16px 18px; font-family:'DM Sans',Arial,sans-serif;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="top" width="30" style="font-size:18px; line-height:22px;">&#128737;&#65039;</td>
                              <td valign="top" style="padding-left:10px; font-size:13px; line-height:20px; color:#6B668C;">
                                This link only works for the account that requested it. If you didn&rsquo;t ask to reset your password, you can safely ignore this email &mdash; nothing will change.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:24px 44px 40px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(91,82,224,0.12);">
                      <tr><td style="height:22px; font-size:0; line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td align="center" style="font-family:'DM Sans',Arial,sans-serif;">
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
            <td align="center" style="padding:28px 30px 8px 30px; font-family:'DM Sans',Arial,sans-serif;">
              <p style="margin:0 0 8px 0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:15px; color:#2A2558;">BLD</p>
              <p style="margin:0 0 14px 0; font-size:12px; line-height:18px; color:#6B668C;">
                The managed marketplace connecting clients with independent site surveyors.
              </p>
              <p style="margin:0; font-size:11px; color:#9B94FF;">&copy; {{current_year}} BLD. All rights reserved.</p>
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
