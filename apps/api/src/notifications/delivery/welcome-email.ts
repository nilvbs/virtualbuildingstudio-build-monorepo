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
 * Branded welcome after Create account.
 * Client and surveyor use dedicated marketing HTML templates.
 */
export function buildWelcomeEmail(input: {
  fullName: string;
  role: MembershipRole;
  appUrl: string;
}): WelcomeEmailContent {
  const name = firstName(input.fullName);
  const base = input.appUrl.replace(/\/$/, '');
  const privacyUrl = `${base}/terms`;
  const year = String(new Date().getFullYear());
  const subject = `Welcome to BLD, ${name}`;

  if (input.role === 'surveyor') {
    const profileUrl = `${base}/onboarding`;
    const unsubscribeUrl = `mailto:support@bld.online?subject=${encodeURIComponent('Unsubscribe from BLD emails')}`;
    const text = [
      `Welcome to BLD, ${name}`,
      '',
      "You're now part of our network of independent site surveyors. Let's get you set up to receive work.",
      '',
      'Complete your profile to start getting matched with survey jobs near you.',
      '',
      `Complete your profile: ${profileUrl}`,
      '',
      'Questions? Reply to this email or reach us at support@bld.online.',
      '',
      '— The BLD team',
    ].join('\n');

    const html = fill(SURVEYOR_WELCOME_HTML, {
      first_name: escapeHtml(name),
      profile_url: escapeHtml(profileUrl),
      unsubscribe: escapeHtml(unsubscribeUrl),
      privacy_url: escapeHtml(privacyUrl),
      current_year: year,
    });

    return { subject, text, html };
  }

  const dashboardUrl = `${base}/onboarding`;
  const unsubscribeUrl = `mailto:support@bld.online?subject=${encodeURIComponent('Unsubscribe from BLD emails')}`;
  const text = [
    `Welcome to BLD, ${name}`,
    '',
    "You're in. We connect you with vetted, independent site surveyors — anywhere, on your schedule.",
    '',
    'Complete a few quick steps, then you can post projects and get matched with vetted surveyors.',
    '',
    `Post your first project: ${dashboardUrl}`,
    '',
    'Need a hand? Reply to this email or reach us at support@bld.online.',
    '',
    '— The BLD team',
  ].join('\n');

  const html = fill(CLIENT_WELCOME_HTML, {
    first_name: escapeHtml(name),
    dashboard_url: escapeHtml(dashboardUrl),
    unsubscribe: escapeHtml(unsubscribeUrl),
    privacy_url: escapeHtml(privacyUrl),
    current_year: year,
  });

  return { subject, text, html };
}

const EMAIL_CSS = `
  body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
  body { margin:0; padding:0; width:100%!important; height:100%!important; }
  a { text-decoration:none; }

  @keyframes bldGradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes bldFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
  @keyframes bldPulse { 0%{box-shadow:0 0 0 0 rgba(255,255,255,0.45)} 70%{box-shadow:0 0 0 14px rgba(255,255,255,0)} 100%{box-shadow:0 0 0 0 rgba(255,255,255,0)} }
  @keyframes bldSheen { 0%{transform:translateX(-120%)} 60%,100%{transform:translateX(320%)} }
  @keyframes bldArrow { 0%,100%{transform:translateX(0)} 50%{transform:translateX(5px)} }
  @keyframes bldFadeUp { 0%{opacity:0; transform:translateY(14px)} 100%{opacity:1; transform:translateY(0)} }
  @keyframes bldGlow { 0%,100%{opacity:0.55} 50%{opacity:1} }

  .anim-hero { background-size:220% 220%!important; animation:bldGradient 9s ease infinite; }
  .anim-badge { animation:bldPulse 2.6s ease-out infinite; }
  .anim-float { animation:bldFloat 4s ease-in-out infinite; }
  .anim-fade1 { animation:bldFadeUp 0.7s ease both; }
  .anim-fade2 { animation:bldFadeUp 0.7s ease 0.12s both; }
  .anim-fade3 { animation:bldFadeUp 0.7s ease 0.24s both; }
  .cta-wrap { position:relative; overflow:hidden; }
  .cta-sheen { position:absolute; top:0; left:0; width:40%; height:100%; background:linear-gradient(120deg,transparent,rgba(113,104,246,0.18),transparent); animation:bldSheen 3.4s ease-in-out infinite; pointer-events:none; }
  .cta-arrow { display:inline-block; animation:bldArrow 1.4s ease-in-out infinite; }
  .glow-dot { animation:bldGlow 2.2s ease-in-out infinite; }

  .card { transition:transform .25s cubic-bezier(0.22,0.61,0.36,1), box-shadow .25s ease, border-color .25s ease; }
  .card:hover { transform:translateY(-4px); box-shadow:0 16px 30px rgba(42,37,88,0.16)!important; border-color:rgba(91,82,224,0.28)!important; }
  .btn-solid { transition:background .2s ease, transform .2s ease; }
  .btn-solid:hover { background:#F2F0FF!important; transform:translateY(-2px); }
  .btn-ghost:hover { background:#F2F0FF!important; }
  .icon-tile { transition:transform .3s ease; }
  .card:hover .icon-tile { transform:scale(1.08) rotate(-3deg); }

  @media (prefers-reduced-motion: reduce) {
    .anim-hero,.anim-badge,.anim-float,.anim-fade1,.anim-fade2,.anim-fade3,.cta-sheen,.cta-arrow,.glow-dot { animation:none!important; }
  }
  @media screen and (max-width:620px) {
    .container { width:100%!important; }
    .px { padding-left:24px!important; padding-right:24px!important; }
    .hero-pad { padding:44px 26px 48px 26px!important; }
    .h1 { font-size:30px!important; line-height:36px!important; }
    .col { display:block!important; width:100%!important; padding:0 0 14px 0!important; }
    .col-last { padding-bottom:0!important; }
  }
`;

const CLIENT_WELCOME_HTML = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to BLD</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
${EMAIL_CSS}
</style>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FF; font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F7F8FF;">
    Welcome to BLD &mdash; your account is ready. Post your first survey in minutes. &#8203;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <center style="width:100%; background-color:#F7F8FF;">
  <!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F8FF; background:linear-gradient(180deg,#EEEAFF 0%,#F7F8FF 340px);">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <tr>
            <td align="center" style="padding:0 0 26px 0;">
              <span style="font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:24px; letter-spacing:-0.02em; color:#2A2558;">BLD</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 20px 48px rgba(42,37,88,0.14);">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td class="hero-pad anim-hero" align="center" style="padding:52px 44px 56px 44px; background:#7168F6; background:linear-gradient(135deg,#4A42C9 0%,#5B52E0 30%,#7168F6 55%,#9B94FF 100%);">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px auto;" class="anim-fade1">
                      <tr>
                        <td class="anim-badge" style="padding:7px 16px; background-color:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.34); border-radius:100px; font-family:'Inter',Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#FFFFFF;">
                          <span class="glow-dot">&#9679;</span>&nbsp; Account activated
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;" class="anim-fade2">
                      <tr>
                        <td class="anim-float" style="width:76px; height:76px; background:linear-gradient(135deg,#EEEAFF 0%,#A29BFF 100%); border-radius:22px; text-align:center; vertical-align:middle; box-shadow:0 12px 26px rgba(42,37,88,0.30);">
                          <span style="font-size:36px; line-height:76px;">&#128737;&#65039;</span>
                        </td>
                      </tr>
                    </table>

                    <h1 class="h1 anim-fade2" style="margin:0; font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:34px; line-height:40px; letter-spacing:-0.02em; color:#FFFFFF;">
                      Welcome to BLD, {{first_name}}
                    </h1>

                    <p class="anim-fade3" style="margin:16px auto 0 auto; max-width:420px; font-family:'Inter',Arial,sans-serif; font-size:16px; line-height:25px; color:#EEEAFF;">
                      You&rsquo;re in. We connect you with vetted, independent site surveyors &mdash; anywhere, on your schedule.
                    </p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px auto 0 auto;" class="anim-fade3">
                      <tr>
                        <td align="center" class="cta-wrap btn-solid" style="border-radius:12px; background-color:#FFFFFF; box-shadow:0 8px 20px rgba(42,37,88,0.24);">
                          <span class="cta-sheen"></span>
                          <a href="{{dashboard_url}}" target="_blank" style="display:inline-block; position:relative; padding:16px 40px; font-family:'Inter',Arial,sans-serif; font-size:15px; font-weight:700; color:#5B52E0; border-radius:12px; letter-spacing:0.01em;">
                            Post your first project &nbsp;<span class="cta-arrow">&rarr;</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:40px 44px 10px 44px;">
                    <p style="margin:0; font-family:'Inter',Arial,sans-serif; font-size:16px; line-height:26px; color:#6B668C;">
                      Thanks for joining <strong style="color:#2A2558;">BLD</strong> &mdash; the managed marketplace built to get your site surveys done faster, with less hassle. Here&rsquo;s how it works.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:26px 44px 8px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="col" valign="top" width="50%" style="padding-right:8px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.12); border-radius:16px;">
                            <tr>
                              <td style="padding:22px 20px; font-family:'Inter',Arial,sans-serif;">
                                <div class="icon-tile" style="width:44px; height:44px; background-color:#FFFFFF; border-radius:12px; text-align:center; line-height:44px; font-size:22px; margin-bottom:14px; box-shadow:0 4px 10px rgba(42,37,88,0.10);">&#128221;</div>
                                <p style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#2A2558;">Post your project</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#6B668C;">Scope, location, timeline &mdash; in under 5 minutes.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="col col-last" valign="top" width="50%" style="padding-left:8px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.12); border-radius:16px;">
                            <tr>
                              <td style="padding:22px 20px; font-family:'Inter',Arial,sans-serif;">
                                <div class="icon-tile" style="width:44px; height:44px; background-color:#FFFFFF; border-radius:12px; text-align:center; line-height:44px; font-size:22px; margin-bottom:14px; box-shadow:0 4px 10px rgba(42,37,88,0.10);">&#129309;</div>
                                <p style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#2A2558;">Get matched</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#6B668C;">We connect you to vetted surveyors near your site.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:16px 44px 8px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.12); border-radius:16px;">
                      <tr>
                        <td style="padding:22px 20px; font-family:'Inter',Arial,sans-serif;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="top" width="58">
                                <div class="icon-tile" style="width:44px; height:44px; background-color:#FFFFFF; border-radius:12px; text-align:center; line-height:44px; font-size:22px; box-shadow:0 4px 10px rgba(42,37,88,0.10);">&#128200;</div>
                              </td>
                              <td valign="top" style="padding-left:14px;">
                                <p style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#2A2558;">Track it end to end</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#6B668C;">Follow progress, review deliverables, and manage everything from one dashboard.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:28px 44px 40px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="anim-hero" style="background:#7168F6; background:linear-gradient(135deg,#7168F6 0%,#5B52E0 60%,#4A42C9 100%); background-size:220% 220%; border-radius:18px;">
                      <tr>
                        <td style="padding:26px 28px; font-family:'Inter',Arial,sans-serif;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td class="col" valign="middle" style="padding-right:12px;">
                                <p style="margin:0 0 4px 0; font-family:'Inter',Arial,sans-serif; font-size:18px; font-weight:700; color:#FFFFFF;">Ready when you are</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#EEEAFF;">Your dashboard is set up and waiting.</p>
                              </td>
                              <td class="col col-last" valign="middle" align="right" width="180" style="text-align:right;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
                                  <tr>
                                    <td class="btn-ghost" style="border-radius:12px; background-color:#FFFFFF;">
                                      <a href="{{dashboard_url}}" target="_blank" style="display:inline-block; padding:13px 26px; font-family:'Inter',Arial,sans-serif; font-size:14px; font-weight:700; color:#5B52E0; border-radius:12px;">Open dashboard</a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:0 44px 40px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(91,82,224,0.12);">
                      <tr><td style="height:28px; font-size:0; line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td align="center" style="font-family:'Inter',Arial,sans-serif;">
                          <p style="margin:0 0 6px 0; font-size:14.5px; font-weight:700; color:#2A2558;">Need a hand getting started?</p>
                          <p style="margin:0; font-size:13.5px; line-height:21px; color:#6B668C;">
                            Just reply to this email, or reach us at
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
            <td align="center" style="padding:30px 30px 8px 30px; font-family:'Inter',Arial,sans-serif;">
              <p style="margin:0 0 8px 0; font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:16px; color:#2A2558;">BLD</p>
              <p style="margin:0 0 16px 0; font-size:12.5px; line-height:19px; color:#6B668C;">
                The managed marketplace connecting clients with independent site surveyors.
              </p>
              <p style="margin:0 0 6px 0; font-size:11.5px; line-height:17px; color:#9B94FF;">
                You&rsquo;re receiving this because you created an account with BLD.
              </p>
              <p style="margin:0 0 16px 0; font-size:11.5px; color:#9B94FF;">
                <a href="{{unsubscribe}}" style="color:#6B668C; text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="{{privacy_url}}" style="color:#6B668C; text-decoration:underline;">Privacy Policy</a>
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

const SURVEYOR_WELCOME_HTML = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Welcome to BLD</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
${EMAIL_CSS}
</style>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FF; font-family:'Inter','Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F7F8FF;">
    Welcome to BLD &mdash; complete your profile to start getting matched with survey work near you. &#8203;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <center style="width:100%; background-color:#F7F8FF;">
  <!--[if mso]><table role="presentation" width="100%"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F7F8FF; background:linear-gradient(180deg,#EEEAFF 0%,#F7F8FF 340px);">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

          <tr>
            <td align="center" style="padding:0 0 26px 0;">
              <span style="font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:24px; letter-spacing:-0.02em; color:#2A2558;">BLD</span>
            </td>
          </tr>

          <tr>
            <td style="background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 20px 48px rgba(42,37,88,0.14);">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <tr>
                  <td class="hero-pad anim-hero" align="center" style="padding:52px 44px 56px 44px; background:#7168F6; background:linear-gradient(135deg,#4A42C9 0%,#5B52E0 30%,#7168F6 55%,#9B94FF 100%);">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 22px auto;" class="anim-fade1">
                      <tr>
                        <td class="anim-badge" style="padding:7px 16px; background-color:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.34); border-radius:100px; font-family:'Inter',Arial,sans-serif; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#FFFFFF;">
                          <span class="glow-dot">&#9679;</span>&nbsp; Welcome aboard
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px auto;" class="anim-fade2">
                      <tr>
                        <td class="anim-float" style="width:76px; height:76px; background:linear-gradient(135deg,#EEEAFF 0%,#A29BFF 100%); border-radius:22px; text-align:center; vertical-align:middle; box-shadow:0 12px 26px rgba(42,37,88,0.30);">
                          <span style="font-size:36px; line-height:76px;">&#128205;</span>
                        </td>
                      </tr>
                    </table>

                    <h1 class="h1 anim-fade2" style="margin:0; font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:34px; line-height:40px; letter-spacing:-0.02em; color:#FFFFFF;">
                      Welcome to BLD, {{first_name}}
                    </h1>

                    <p class="anim-fade3" style="margin:16px auto 0 auto; max-width:430px; font-family:'Inter',Arial,sans-serif; font-size:16px; line-height:25px; color:#EEEAFF;">
                      You&rsquo;re now part of our network of independent site surveyors. Let&rsquo;s get you set up to receive work.
                    </p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px auto 0 auto;" class="anim-fade3">
                      <tr>
                        <td align="center" class="cta-wrap btn-solid" style="border-radius:12px; background-color:#FFFFFF; box-shadow:0 8px 20px rgba(42,37,88,0.24);">
                          <span class="cta-sheen"></span>
                          <a href="{{profile_url}}" target="_blank" style="display:inline-block; position:relative; padding:16px 40px; font-family:'Inter',Arial,sans-serif; font-size:15px; font-weight:700; color:#5B52E0; border-radius:12px; letter-spacing:0.01em;">
                            Complete your profile &nbsp;<span class="cta-arrow">&rarr;</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:40px 44px 10px 44px;">
                    <p style="margin:0; font-family:'Inter',Arial,sans-serif; font-size:16px; line-height:26px; color:#6B668C;">
                      Thanks for joining <strong style="color:#2A2558;">BLD</strong> as a site surveyor &mdash; the managed marketplace that brings vetted survey work straight to you. A complete profile gets you matched faster. Here&rsquo;s how it works.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:26px 44px 8px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td class="col" valign="top" width="50%" style="padding-right:8px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.12); border-radius:16px;">
                            <tr>
                              <td style="padding:22px 20px; font-family:'Inter',Arial,sans-serif;">
                                <div class="icon-tile" style="width:44px; height:44px; background-color:#FFFFFF; border-radius:12px; text-align:center; line-height:44px; font-size:22px; margin-bottom:14px; box-shadow:0 4px 10px rgba(42,37,88,0.10);">&#128100;</div>
                                <p style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#2A2558;">Complete your profile</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#6B668C;">Add your skills, equipment, and coverage area to get verified.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="col col-last" valign="top" width="50%" style="padding-left:8px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.12); border-radius:16px;">
                            <tr>
                              <td style="padding:22px 20px; font-family:'Inter',Arial,sans-serif;">
                                <div class="icon-tile" style="width:44px; height:44px; background-color:#FFFFFF; border-radius:12px; text-align:center; line-height:44px; font-size:22px; margin-bottom:14px; box-shadow:0 4px 10px rgba(42,37,88,0.10);">&#128205;</div>
                                <p style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#2A2558;">Get matched to jobs</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#6B668C;">We surface survey jobs near you that fit your expertise.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:16px 44px 8px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" style="background:linear-gradient(180deg,#FBFBFF 0%,#EEEAFF 100%); border:1px solid rgba(91,82,224,0.12); border-radius:16px;">
                      <tr>
                        <td style="padding:22px 20px; font-family:'Inter',Arial,sans-serif;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="top" width="58">
                                <div class="icon-tile" style="width:44px; height:44px; background-color:#FFFFFF; border-radius:12px; text-align:center; line-height:44px; font-size:22px; box-shadow:0 4px 10px rgba(42,37,88,0.10);">&#128176;</div>
                              </td>
                              <td valign="top" style="padding-left:14px;">
                                <p style="margin:0 0 4px 0; font-size:15px; font-weight:700; color:#2A2558;">Deliver &amp; get paid</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#6B668C;">Upload your deliverables through the dashboard and get paid securely, on time.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:28px 44px 40px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="anim-hero" style="background:#7168F6; background:linear-gradient(135deg,#7168F6 0%,#5B52E0 60%,#4A42C9 100%); background-size:220% 220%; border-radius:18px;">
                      <tr>
                        <td style="padding:26px 28px; font-family:'Inter',Arial,sans-serif;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td class="col" valign="middle" style="padding-right:12px;">
                                <p style="margin:0 0 4px 0; font-family:'Inter',Arial,sans-serif; font-size:18px; font-weight:700; color:#FFFFFF;">Unlock your first job</p>
                                <p style="margin:0; font-size:13.5px; line-height:20px; color:#EEEAFF;">Finish your profile to start getting matched.</p>
                              </td>
                              <td class="col col-last" valign="middle" align="right" width="180" style="text-align:right;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right">
                                  <tr>
                                    <td class="btn-ghost" style="border-radius:12px; background-color:#FFFFFF;">
                                      <a href="{{profile_url}}" target="_blank" style="display:inline-block; padding:13px 26px; font-family:'Inter',Arial,sans-serif; font-size:14px; font-weight:700; color:#5B52E0; border-radius:12px;">Finish profile</a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:0 44px 40px 44px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid rgba(91,82,224,0.12);">
                      <tr><td style="height:28px; font-size:0; line-height:0;">&nbsp;</td></tr>
                      <tr>
                        <td align="center" style="font-family:'Inter',Arial,sans-serif;">
                          <p style="margin:0 0 6px 0; font-size:14.5px; font-weight:700; color:#2A2558;">Questions about getting started?</p>
                          <p style="margin:0; font-size:13.5px; line-height:21px; color:#6B668C;">
                            Just reply to this email, or reach us at
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
            <td align="center" style="padding:30px 30px 8px 30px; font-family:'Inter',Arial,sans-serif;">
              <p style="margin:0 0 8px 0; font-family:'Inter',Arial,sans-serif; font-weight:700; font-size:16px; color:#2A2558;">BLD</p>
              <p style="margin:0 0 16px 0; font-size:12.5px; line-height:19px; color:#6B668C;">
                The managed marketplace connecting clients with independent site surveyors.
              </p>
              <p style="margin:0 0 6px 0; font-size:11.5px; line-height:17px; color:#9B94FF;">
                You&rsquo;re receiving this because you signed up as a surveyor with BLD.
              </p>
              <p style="margin:0 0 16px 0; font-size:11.5px; color:#9B94FF;">
                <a href="{{unsubscribe}}" style="color:#6B668C; text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="{{privacy_url}}" style="color:#6B668C; text-decoration:underline;">Privacy Policy</a>
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
