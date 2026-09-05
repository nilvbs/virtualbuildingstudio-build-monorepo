# How the database is organised

There are **11 tables**. Think in **four groups**. Everything hangs off **one person** (`users`).

```
Person (users)
  ├─ Sign-in                   auth_provider + auth_subject
  ├─ Hats                      user_roles            (client / surveyor / admin)
  ├─ Address + company         account_profiles      (shared)
  ├─ Surveyor listing          surveyor_profiles     (geo, rates, portfolio JSON)
  └─ Staff                     admin_profiles        (permissions)

Jobs
  projects   — a client posts a brief (pin + JSON details)
  matches    — an admin pairs that job with a surveyor

Plumbing
  contact_otps     — short-lived SMS/email codes
  notifications    — in-app messages
```

## Group 1 — The person

| Table | One sentence |
|---|---|
| `users` | Login identity: name, email, phone, onboarding step, Auth0/Google ids. |
| `user_roles` | Hats: `client`, `surveyor`, `admin`. One person can have several rows. |

`users.role_hint` is a leftover display field. **Do not use it for access.** Use `user_roles`.

## Group 2 — Extra profile rows (optional 1:1)

| Table | When it exists | What is in it |
|---|---|---|
| `account_profiles` | After profile onboarding | Address, company name, work email, registration, website. |
| `surveyor_profiles` | Surveyor hat | Services, equipment, map pin (`base_location`), radius, rate, portfolio JSON. |
| `admin_profiles` | Staff only | Staff level and permission preset. |

PostGIS lives only on `surveyor_profiles` and `projects`.

## Group 3 — The marketplace loop

```
Client (user)
    posts →  Project  (title, services JSON, map pin, wizard `details` JSON)
                 │
                 │  admin creates
                 ▼
              Match
                 └── SurveyorProfile (not the User row)
```

| Table | One sentence |
|---|---|
| `projects` | The job. `client_id` → `users`. Wizard extras are `details` JSON. |
| `matches` | One pairing: this project ↔ this surveyor, created by this admin (`matched_by`). |

## Group 4 — Plumbing

| Table | One sentence |
|---|---|
| `contact_otps` | Hashed OTP, expiry, consumed flag. |
| `notifications` | Inbox rows (`kind`, `title`, `link_url`, `read_at`). |

## JSON (not more tables)

- `projects.details` — posting wizard
- `projects.services` / `surveyor_profiles.services` — string arrays
- `surveyor_profiles.details` / `portfolio` — portfolio wizard
- `admin_profiles.permissions` — extra staff flags

## How to proceed in code

1. Auth / onboarding → `users`, `user_roles`, `account_profiles`, `contact_otps`
2. Client posts a job → `projects`
3. Surveyor listing → `surveyor_profiles`
4. Admin pairs them → `matches`
5. Alerts → `notifications`

Schema: `schema.prisma` + `migrations/`. Apply with `pnpm db:migrate`.
