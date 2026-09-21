# BLD business logic

> **Living document.** Update this file whenever marketplace / auth / matching / admin / helpdesk / notification behavior changes.
> Data shape / ERD: [`docs/DATA_VISUAL.md`](./DATA_VISUAL.md) · narrative: [`apps/api/prisma/DATA_MODEL.md`](../apps/api/prisma/DATA_MODEL.md).
> Status enums & transitions: [`packages/types/src/index.ts`](../packages/types/src/index.ts).

Last reviewed: 2026-09-21

---

## 1. Product in one paragraph

BLD is a **managed marketplace**: clients post site-survey projects; the platform **auto-matches** nearby live surveyors with time-boxed offers; surveyors accept/decline; work moves through project status until completion and feedback. One person can wear **client** and/or **surveyor** (and separately **admin** staff) hats on a single identity.

---

## 2. Roles & identity

| Role | Stored in | Purpose |
|------|-----------|---------|
| `client` | `user_roles` | Post projects, track matches, leave feedback |
| `surveyor` | `user_roles` + `surveyor_profiles` | Receive offers, accept work, complete portfolio |
| `admin` | `user_roles` + `admin_profiles` | Staff portal (`/build/admin`), permissions presets |

- Access control uses **memberships**, not `users.role_hint` (legacy display only).
- Session may carry `activeRole` (`client` \| `surveyor`) for workspace routing.
- **Dual-role:** signing up again with the same email **adds** the other marketplace role; shared onboarding progress is kept; UI shows an `accountNotice`.
- **Staff invite (super admin only):** create normal admin → email with **Access portal** CTA only (no credentials or paste-URL in the mail) + SMS + in-app. Link is `/build/admin?invite=…`. System enforces **3-day TTL** and **Monday–Friday** redeem silently (not shown in user copy). Portal prefills email + temp password; successful sign-in accepts the invite. Super admin can edit any staff row (including self) and set passwords.

```mermaid
flowchart LR
  Person[User identity] --> ClientHat[client]
  Person --> SurveyorHat[surveyor]
  Person --> AdminHat[admin]
  ClientHat --> AccountProfile[account_profiles]
  SurveyorHat --> SurveyorProfile[surveyor_profiles]
  AdminHat --> AdminProfile[admin_profiles]
```

```mermaid
flowchart TD
  SA[Super admin invites staff] --> Create[Create admin + invite token]
  Create --> Mail[Email Access portal CTA]
  Create --> SMS[SMS + in-app]
  Mail --> Link["/build/admin?invite=token"]
  Link --> Peek{Mon-Fri and within 3 days?}
  Peek -->|no| Fail[Show reason]
  Peek -->|yes| Prefill[Prefill email + temp password]
  Prefill --> Login[Sign in]
  Login --> Accept[Accept invite / clear token]
```

**Key code:** `apps/api/src/auth/memberships.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/admin/admin.service.ts`

---

## 3. Auth & signup

```mermaid
flowchart TD
  Start["Create account / Sign in"] --> EmailCheck{"Email already exists?"}
  EmailCheck -->|Yes| PhoneMatch{"Phone matches that account?"}
  PhoneMatch -->|No| Conflict["Conflict — email or phone already taken"]
  PhoneMatch -->|Yes| AddRole["Verify password + add missing client/surveyor role"]
  EmailCheck -->|No| PhoneCheck{"Phone already exists?"}
  PhoneCheck -->|Yes| Conflict
  PhoneCheck -->|No| CreateUser["Create user + Auth0/dev identity"]
  AddRole --> Notice["Return accountNotice if role added"]
  CreateUser --> Welcome["Send branded welcome email"]
  Notice --> Session["Issue session + activeRole"]
  Welcome --> Session
  Session --> Onboard{"onboardingStep = done?"}
  Onboard -->|No| Onboarding["Go to /onboarding"]
  Onboard -->|Yes| Home["Workspace home"]
```

- **Identity uniqueness:** email and phone are both checked. Reusing one with a different other (e.g. same email + new phone, or new email + existing phone) is blocked. Dual-role only when the same email **and** matching phone (or placeholder phone) pass password verify for a role the account does not yet have.
- Password signup: email/phone OTP **not** sent at create — only from onboarding **Verify contact**.
- Google: complete registration (phone + role) then same onboarding gates.
- Welcome email: branded HTML; client vs surveyor templates; SendGrid (`TwilioEmailSender`).
- Email OTP: branded verify template (`buildVerifyEmail`).
- **Forgot password (marketplace only):** client/surveyor request → branded reset email with one-time **button** link (`/reset-password?token=…`, 1h TTL, bound to that `userId` via `contact_otps` channel `password_reset`). No raw paste-URL block in the HTML. UI shows success + resend + back to login. Completing the link sets Auth0 + local password verifier for that user only; token is single-use. Staff/admin accounts are never emailed a reset. Anti-enumeration: API always returns the same ok message.

```mermaid
flowchart TD
  Forgot["Forgot password + email + role"] --> Exists{"Active user with that marketplace role?"}
  Exists -->|No| SameOk["Return generic ok"]
  Exists -->|Yes| Issue["Store hashed token on contact_otps + email branded link"]
  Issue --> SameOk
  SameOk --> Open["User opens /reset-password?token"]
  Open --> Peek["Show masked email for that user"]
  Peek --> Save["Set new password for token userId only"]
  Save --> Consume["Consume token + invalidate other reset tokens"]
```

**Key code:** `auth.service.ts`, `email-otp.service.ts`, `welcome-email.ts`, `verify-email.ts`, `reset-password-email.ts`, `twilio.email-sender.ts`

---

## 4. Onboarding gate

Shared for client + surveyor:

```mermaid
flowchart LR
  A[select_account_type] --> B[accept_terms]
  B --> C[verify_contact]
  C --> D[complete_profile]
  D --> E{Surveyor?}
  E -->|Yes| F[portfolio]
  E -->|No| G[done]
  F --> G[done]
```

| Step | What happens |
|------|----------------|
| `select_account_type` | Individual vs company |
| `accept_terms` | T&C + NDA (required) |
| `verify_contact` | **Email OTP + phone OTP (both required)** before profile |
| `complete_profile` | Address / company fields → `account_profiles` |
| `portfolio` | Surveyors only (or client-first then adding surveyor) |
| `done` | Workspace unlocked |

**Dual-role rule:** if core onboarding is already done and surveyor is newly added → jump to `portfolio` only.

**Key code:** `auth.service.ts` (`resolveOnboardingStep`, `attachMarketplaceRole`, `surveyorNeedsPortfolioStep`), `apps/web/app/onboarding/page.tsx`

---

## 5. Client project lifecycle

```mermaid
stateDiagram-v2
  [*] --> submitted: Client posts project
  submitted --> matching: Auto-match starts
  matching --> matched: Surveyor accepts offer
  matched --> confirmed: Pipeline / admin confirm
  confirmed --> completed: Work finished
  submitted --> cancelled
  matching --> cancelled
  matched --> cancelled
  confirmed --> cancelled
  completed --> [*]
  cancelled --> [*]
```

Allowed transitions: `PROJECT_STATUS_TRANSITIONS` in `@surveylink/types`.

**Key code:** `apps/api/src/projects/projects.service.ts`, `apps/web/app/client/projects/**`

---

## 6. Matching & offers

```mermaid
sequenceDiagram
  participant C as Client
  participant API as Projects/AutoMatch
  participant S as Surveyors
  participant N as Notifications

  C->>API: POST project (geo and services)
  API->>API: status to matching
  API->>API: Rank nearby live surveyors
  loop Up to max offers
    API->>S: Match proposed with deadline (working hours)
    API->>N: In-app / email / SMS offer
  end
  alt Surveyor accepts
    S->>API: accept
    API->>API: match accepted, project to matched
    API->>N: Notify client and others
  else Decline or expire
    S->>API: decline or timeout
    API->>API: Rematch / next candidate
  end
```

- Offer deadlines use **working hours** (`matching/working-hours.ts`), not raw wall clock alone.
- Background rematch retries open `matching` projects.
- Admin can also create / manage matches from staff UI.

Match statuses: `proposed → accepted | declined | cancelled`; `accepted → completed | cancelled`.

**Key code:** `apps/api/src/matching/auto-match.service.ts`, `apps/api/src/admin/admin.service.ts`

---

## 7. Surveyor portfolio & eligibility

- Surveyor profile holds services, coverage (PostGIS), rates, portfolio JSON.
- **Pricing currency is fixed to USD** (not editable in UI; normalized on save).
- **Remote services** is no longer collected in surveyor UI (field may still exist in stored JSON as legacy `false`).
- Incomplete portfolio blocks receiving / acting on marketplace requests (web gates + matching filters for “live” surveyors).
- Profile completion % drives UI prompts (`profile-completion`, surveyor shell snooze).

**Key code:** `apps/api/src/profiles/profiles.service.ts`, `apps/web/app/surveyor/profile/page.tsx`

---

## 8. Feedback

- After completed work, client ↔ surveyor can leave feedback (one per direction per match).
- Product / landing feedback also collected for ops.

**Key code:** `apps/api/src/feedback/feedback.service.ts`

---

## 9. Helpdesk

- Authenticated users open tickets (workspace-scoped).
- Staff assign / reply in admin help desk.
- Notifications on create / reply.

**Key code:** `apps/api/src/helpdesk/helpdesk.service.ts`

---

## 10. Notifications & delivery

| Channel | Provider (staging) | Used for |
|---------|-------------------|----------|
| Email | SendGrid (`SENDGRID_API_KEY`, `TWILIO_EMAIL_FROM`) | Welcome, OTP, match/admin alerts |
| SMS | Twilio Messaging | Phone OTP, match SMS |
| In-app | `notifications` table | Bell / toasts |

Failures on welcome are best-effort (never block signup). OTP send failures surface as unavailable.

**Key code:** `apps/api/src/notifications/**`

---

## 11. Admin / staff

- Super-admin bootstrap; staff levels + permission presets.
- **Overview** (`/build/admin/queue`): network totals (incl. complete surveyor profiles), daily activity **bar chart + 7-day trend line**, services coverage bars, regional breakdown; date/region filters.
- **Users** detail: view-only by default; pencil unlocks account edit/verify; surveyor portfolio opens from the user header (**View portfolio** drawer), not a separate sidebar module.
- Pipeline / users / projects / helpdesk / activity.
- User delete must clear surveyor profile + matches (no FK cascade on surveyor→user).

**Key code:** `apps/api/src/admin/**`, `apps/web/app/build/admin/**`

---

## 12. Module map (API)

| Module | Responsibility |
|--------|----------------|
| `auth` | Signup, login, onboarding, OTP, sessions |
| `projects` | Client briefs |
| `matching` | Auto-match loop |
| `profiles` | Account + surveyor portfolio |
| `admin` | Staff operations |
| `notifications` | Fan-out delivery |
| `helpdesk` | Tickets |
| `feedback` | Ratings |
| `media` | S3 uploads |
| `activity` | Audit-ish logs |

---

## 13. Changelog (business-facing)

| Date | Change |
|------|--------|
| 2026-09-21 | Staff invite email: Access portal CTA only; no credentials / paste URL / Mon–Fri or TTL copy (rules enforced silently) |
| 2026-09-21 | Staff invite: right-drawer create, email Access portal CTA + SMS/in-app, 3-day Mon–Fri link prefills portal credentials; super admin pencil edit + password (masked + eye) |
| 2026-09-21 | Admin sidebar: **Surveyors** nav removed — portfolio managed from Users detail drawer |
| 2026-09-21 | Admin user detail: view-only by default; pencil unlocks account edit; **View portfolio** drawer also has circled pencil to edit surveyor portfolio |
| 2026-09-19 | Verify contact: Continue after both email+phone verified; heal stuck `verify_contact` when contacts already done |
| 2026-09-19 | Signup: email **and** phone uniqueness (partial reuse blocked); dual-role requires matching phone; reset email paste-link removed; portfolio currency locked to USD; Remote services UI removed |
| 2026-09-19 | Admin **surveyor directory + overview analytics**: complete-profile visibility, service coverage charts, activity bars with trend line, quick + advanced surveyor filters, full profile dossier |
| 2026-09-19 | Marketplace **forgot password**: branded reset email, success/resend UI, `/reset-password` bound to requesting user only |
| 2026-09-19 | Onboarding **email + phone** both mandatory to leave Verify contact / complete profile |
| 2026-09-18 | Dual-role signup notice; branded welcome (client + surveyor); branded email OTP; SendGrid synced on deploy; admin user delete clears surveyor profile |
| 2026-09-18 | **Doc created** — keep updating this table + diagrams above |

---

## Maintainer checklist

When you change behavior, update:

1. The relevant section + mermaid diagram (if flow changed)
2. The **Changelog** row
3. Cross-links if new modules / enums appear
4. `DATA_MODEL.md` if tables / relations change
