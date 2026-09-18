export interface VerifyEmailContent {
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
 * Branded one-time email verification code (onboarding + work email).
 */
export function buildVerifyEmail(input: {
  fullName?: string | null;
  otpCode: string;
}): VerifyEmailContent {
  const name = firstName(input.fullName);
  const code = input.otpCode.trim();
  const year = String(new Date().getFullYear());
  const subject = 'Your BLD verification code';

  const text = [
    `Hi ${name},`,
    '',
    `Your BLD verification code is ${code}.`,
    'It expires in 10 minutes.',
    '',
    'For your security, never share this code with anyone. BLD staff will never ask you for it.',
    'If you did not request this code, you can safely ignore this email.',
    '',
    'Need help? Reach us at support@bld.online.',
    '',
    '— BLD',
  ].join('\n');

  const html = fill(VERIFY_EMAIL_HTML, {
    first_name: escapeHtml(name),
    otp_code: escapeHtml(code),
    current_year: year,
  });

  return { subject, text, html };
}

const VERIFY_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your BLD verification code</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100%!important; height:100%!important; }
  a { text-decoration:none; }

  @keyframes bldGradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes bldGlow { 0%,100%{opacity:0.55} 50%{opacity:1} }
  @keyframes bldFadeUp { 0%{opacity:0; transform:translateY(12px)} 100%{opacity:1; transform:translateY(0)} }
  .anim-hero { background-size:220% 220%!important; animation:bldGradient 9s ease infinite; }
  .glow-dot { animation:bldGlow 2.2s ease-in-out infinite; }
  .anim-fade { animation:bldFadeUp 0.6s ease both; }
  .code-panel { transition:border-color .2s ease; }
  @media (prefers-reduced-motion: reduce) { .anim-hero,.glow-dot,.anim-fade { animation:none!important; } }
  @media screen and (max-width:620px) {
    .container { width:100%!important; }
    .px { padding-left:24px!important; padding-right:24px!important; }
    .hero-pad { padding:38px 26px 40px 26px!important; }
    .code-text { font-size:36px!important; letter-spacing:10px!important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FF; font-family:'DM Sans','Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F7F8FF;">
    Your BLD verification code is {{otp_code}}. It expires in 10 minutes. &#8203;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <center style="width:100%; background-color:#F7F8FF;">
  <!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
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
                  <td class="hero-pad anim-hero" align="center" style="padding:44px 44px 40px 44px; background:#7168F6; background:linear-gradient(135deg,#4A42C9 0%,#5B52E0 35%,#7168F6 65%,#9B94FF 100%);">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 20px auto;">
                      <tr>
                        <td style="width:64px; height:64px; background:linear-gradient(135deg,#EEEAFF 0%,#A29BFF 100%); border-radius:18px; text-align:center; vertical-align:middle; box-shadow:0 10px 24px rgba(42,37,88,0.28);">
                          <span style="font-size:30px; line-height:64px;">&#128274;</span>
                        </td>
                      </tr>
                    </table>

                    <h1 style="margin:0; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:26px; line-height:32px; letter-spacing:-0.02em; color:#FFFFFF;">
                      Your verification code
                    </h1>
                    <p style="margin:12px auto 0 auto; max-width:400px; font-family:'DM Sans',Arial,sans-serif; font-size:15px; line-height:23px; color:#EEEAFF;">
                      Use the one-time code below to sign in to your BLD account.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:36px 44px 8px 44px;">
                    <p style="margin:0 0 24px 0; font-family:'DM Sans',Arial,sans-serif; font-size:16px; line-height:25px; color:#6B668C;">
                      Hi <strong style="color:#2A2558;">{{first_name}}</strong>, here&rsquo;s your one-time password (OTP). Enter it to continue &mdash; it&rsquo;s valid for the next <strong style="color:#2A2558;">10 minutes</strong>.
                    </p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="anim-fade">
                      <tr>
                        <td align="center" class="code-panel" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.22); border-radius:18px; padding:28px 20px;">
                          <p style="margin:0 0 10px 0; font-family:'DM Sans',Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#6B668C;">Your one-time code</p>
                          <div class="code-text" style="font-family:'DM Sans',Consolas,Menlo,monospace; font-size:44px; font-weight:700; letter-spacing:14px; color:#2A2558; padding-left:14px;">{{otp_code}}</div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px auto 0 auto;">
                      <tr>
                        <td style="padding:8px 16px; background-color:#EEEAFF; border-radius:100px; font-family:'DM Sans',Arial,sans-serif; font-size:13px; font-weight:600; color:#5B52E0;">
                          <span class="glow-dot">&#9679;</span>&nbsp; Expires in 10 minutes
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
                                For your security, never share this code with anyone. BLD staff will <strong style="color:#2A2558;">never</strong> ask you for it. If you didn&rsquo;t request this code, you can safely ignore this email.
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
              <p style="margin:0 0 4px 0; font-size:11.5px; color:#9B94FF;">
                This is an automated security email &mdash; please don&rsquo;t reply directly.
              </p>
              <p style="margin:0; font-size:11px; color:#9B94FF;">&copy; {{current_year}} BLD. All rights reserved.</p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
  </center>

</body>
</html>
`;
