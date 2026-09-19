# BLD data model — live visual

> **Living ERD.** Open this file in Cursor / GitHub preview to see tables and relations.
> Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma) + migrations.
> Narrative companion: [`apps/api/prisma/DATA_MODEL.md`](../apps/api/prisma/DATA_MODEL.md).
> Product flows: [`docs/BUSINESS_LOGIC.md`](./BUSINESS_LOGIC.md).

Last synced from schema: **2026-09-19**

---

## Full schema (entity–relationship)

```mermaid
erDiagram
  users ||--o{ user_roles : "hats"
  users ||--o| account_profiles : "1:1 address/company"
  users ||--o| surveyor_profiles : "1:1 listing"
  users ||--o| admin_profiles : "1:1 staff"
  users ||--o{ contact_otps : "OTP codes"
  users ||--o{ projects : "posts as client"
  users ||--o{ matches : "matched_by"
  users ||--o{ notifications : "inbox"
  users ||--o{ feedbacks : "from_user"
  users ||--o{ feedbacks : "to_user"
  users ||--o{ help_tickets : "owner"
  users ||--o{ help_tickets : "assignee"
  users ||--o{ help_ticket_messages : "author"
  users ||--o{ activity_logs : "actor"

  surveyor_profiles ||--o{ matches : "offers"
  projects ||--o{ matches : "paired"
  projects ||--o{ feedbacks : "about job"
  projects ||--o{ help_tickets : "optional"
  projects ||--o{ activity_logs : "optional"

  matches ||--o{ feedbacks : "post-job rating"
  matches ||--o{ activity_logs : "optional"

  help_tickets ||--o{ help_ticket_messages : "thread"
  help_tickets ||--o{ activity_logs : "optional"

  users {
    uuid id PK
    string full_name
    string first_name
    string last_name
    string username UK
    string email UK
    string phone UK
    boolean email_verified
    boolean phone_verified
    string avatar_key
    string onboarding_step
    string account_type
    timestamp account_type_selected_at
    timestamp terms_accepted_at
    timestamp nda_accepted_at
    string role_hint
    string status
    string auth_provider
    string auth_subject UK
    string password_verifier
  }

  user_roles {
    uuid id PK
    uuid user_id FK
    string role
  }

  account_profiles {
    uuid id PK
    uuid user_id FK,UK
    string company_name
    string address_line1
    string city
    string state
    string postal_code
    string country
    string work_email
    boolean work_email_verified
    float rating_avg
    int rating_count
  }

  surveyor_profiles {
    uuid id PK
    uuid user_id FK,UK
    string bio
    json services
    json equipment
    string base_location
    string base_city
    int radius_km
    int day_rate_cents
    float rating_avg
    boolean bld_verified
    json portfolio
    json details
    boolean is_matchable
  }

  admin_profiles {
    uuid id PK
    uuid user_id FK,UK
    string title
    string staff_level
    string permission_preset
    json permissions
  }

  projects {
    uuid id PK
    uuid client_id FK
    string title
    json services
    string location
    string location_text
    json details
    string status
  }

  matches {
    uuid id PK
    uuid project_id FK
    uuid surveyor_id FK
    uuid matched_by FK
    string status
    timestamp expires_at
    string offer_source
    timestamp proposed_at
    timestamp accepted_at
  }

  feedbacks {
    uuid id PK
    uuid match_id FK
    uuid project_id FK
    uuid from_user_id FK
    uuid to_user_id FK
    string from_role
    int rating
    string comment
    json aspects
  }

  site_feedbacks {
    uuid id PK
    string name
    string email
    int rating
    string message
    string source
  }

  help_tickets {
    uuid id PK
    string ticket_number UK
    uuid user_id FK
    string workspace
    string category
    string priority
    string status
    uuid project_id FK
    uuid assigned_to_user_id FK
  }

  help_ticket_messages {
    uuid id PK
    uuid ticket_id FK
    uuid author_user_id FK
    string body
    json attachments
    boolean is_staff
  }

  activity_logs {
    uuid id PK
    string entity_type
    uuid entity_id
    uuid project_id FK
    uuid match_id FK
    uuid help_ticket_id FK
    string action
    string summary
    uuid actor_user_id FK
    json metadata
  }

  contact_otps {
    uuid id PK
    uuid user_id FK
    string channel
    string destination
    string code_hash
    timestamp expires_at
    timestamp consumed_at
  }

  notifications {
    uuid id PK
    uuid user_id FK
    string kind
    string title
    string body
    string link_url
    string channel
    timestamp read_at
  }
```

---

## By domain group

### Person & profiles

```mermaid
flowchart TB
  U[(users)]
  U --> UR["user_roles<br/>client / surveyor / admin"]
  U --> AP[account_profiles]
  U --> SP["surveyor_profiles<br/>PostGIS pin"]
  U --> ADP[admin_profiles]
  U --> OTP[contact_otps]
  U --> N[notifications]
```

### Marketplace jobs

```mermaid
flowchart LR
  Client[("users client")] -->|client_id| P[(projects)]
  P -->|project_id| M[(matches)]
  SP[(surveyor_profiles)] -->|surveyor_id| M
  Staff[(users)] -->|matched_by| M
  M --> FB[(feedbacks)]
  P --> FB
```

### Help desk & activity

```mermaid
flowchart TB
  U[(users)] -->|"owner / assignee"| HT[(help_tickets)]
  P[(projects)] -.->|optional| HT
  HT --> HM[help_ticket_messages]
  U --> HM
  HT -.-> AL[(activity_logs)]
  P -.-> AL
  M[(matches)] -.-> AL
  U -.->|actor| AL
```
`site_feedbacks` is standalone (landing page); no FK to `users`.

---

## Cascade / delete notes (important)

| Relation | On delete |
|----------|-----------|
| Most profile / OTP / role / feedback / ticket → `users` | **Cascade** |
| `surveyor_profiles.user_id` → `users` | **No cascade** — admin delete must remove profile first |
| `projects.client_id` / `matches.*` → users/profiles | App-managed (no Prisma cascade on all) |
| `notifications.user_id` | No cascade in Prisma — delete notifications before user |
| Help ticket assignee | **SetNull** |
| Activity log FKs | **SetNull** where optional |

---

## Status / enum columns (string CHECKs in SQL)

| Table | Column | Values (app) |
|-------|--------|----------------|
| `users` | `onboarding_step` | select_account_type → … → done |
| `users` | `account_type` | individual \| company |
| `user_roles` | `role` | client \| surveyor \| admin |
| `projects` | `status` | submitted → matching → matched → confirmed → completed \| cancelled |
| `matches` | `status` | proposed \| accepted \| declined \| completed \| cancelled |
| `matches` | `offer_source` | admin \| auto |
| `help_tickets` | `status` | open \| in_progress \| waiting \| resolved \| closed |
| `notifications` | `channel` | in_app \| email \| sms |

See `@surveylink/types` for transition maps.

---

## Table inventory

| Table | Group |
|-------|--------|
| `users` | Person |
| `user_roles` | Person |
| `account_profiles` | Profiles |
| `surveyor_profiles` | Profiles |
| `admin_profiles` | Profiles |
| `projects` | Jobs |
| `matches` | Jobs |
| `feedbacks` | Jobs |
| `site_feedbacks` | Plumbing / marketing |
| `help_tickets` | Support |
| `help_ticket_messages` | Support |
| `activity_logs` | Ops |
| `contact_otps` | Plumbing |
| `notifications` | Plumbing |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09-19 | `contact_otps.channel` check allows `password_reset` (forgot-password tokens) |
| 2026-09-18 | **Doc created** from current `schema.prisma` (full ERD + domain views + cascade notes) |

---

## Maintainer checklist

When you change `schema.prisma` or add a migration:

1. Update the **Full schema** mermaid `erDiagram` (entities + relationships).
2. Update domain diagrams / inventory / cascade notes if affected.
3. Bump **Last synced** date and add a **Changelog** row.
4. Keep `DATA_MODEL.md` prose in sync for human-readable grouping.
