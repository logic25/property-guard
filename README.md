# Property Guard

NYC property compliance management platform. Monitor DOB/ECB/HPD violations, track building permits, manage compliance deadlines, and generate due diligence reports — all from one dashboard.

## Features

### Core
- **Property Management** — Add NYC properties by address; auto-populates building data from PLUTO + DOB Jobs datasets
- **Violation Tracking** — Syncs DOB, ECB, HPD, FDNY violations from NYC Open Data with severity classification and aging
- **Compliance Scoring** — Automated A–F grading based on open violations, overdue filings, and resolution speed
- **Due Diligence Reports** — Generate comprehensive property reports with violations, applications, and AI analysis
- **Work Orders** — Create and track remediation work linked to specific violations and vendors
- **Document Management** — Upload leases, permits, COIs with expiration tracking and AI-powered Q&A
- **Notifications** — Real-time alerts for new violations, compliance deadlines, and document expirations

### Communication
- **Email Digests** — Configurable weekly/daily summary emails via Resend
- **SMS Alerts** — Twilio-powered SMS for critical violations
- **Telegram Bot** — Link your Telegram account for instant violation alerts

### Admin Panel
- **API Health Dashboard** — Real-time monitoring of NYC Open Data API endpoints (PLUTO, DOB, ECB, OATH) with status, latency, and error tracking
- **User Management** — View all users, their properties, violation counts, AI usage, and DD report activity
- **User Detail** — Deep dive into any user's account with property list and usage metrics
- **Role System** — Secure `user_roles` table with `has_role()` security-definer function (no privilege escalation)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State | TanStack React Query |
| Routing | React Router v6 |
| Backend | Lovable Cloud (Supabase) |
| Auth | Email/password with RLS |
| Edge Functions | Deno (violation sync, AI, email, SMS, Telegram) |
| Charts | Recharts |

## Project Structure

```
src/
├── components/
│   ├── auth/              # ProtectedRoute
│   ├── dashboard/         # Layout, sidebar, stats cards
│   ├── dd-reports/        # Due diligence report components
│   ├── landing/           # Marketing pages
│   ├── lease/             # Lease Q&A chat
│   ├── portfolios/        # Portfolio management
│   ├── properties/        # Property CRUD, detail tabs, address autocomplete
│   ├── settings/          # Email & Telegram preferences
│   ├── ui/                # shadcn/ui components
│   └── violations/        # Work order creation
├── hooks/
│   ├── useAuth.tsx         # Auth context provider
│   ├── useAdminRole.ts     # Admin role check hook
│   ├── useComplianceScore.ts
│   └── useNotifications.ts
├── lib/
│   ├── api-logger.ts       # NYC API call logging wrapper
│   ├── nyc-building-sync.ts # PLUTO + DOB data sync
│   ├── violation-severity.ts
│   ├── violation-aging.ts
│   └── local-law-engine.ts # Compliance requirement engine
├── pages/
│   ├── dashboard/
│   │   ├── admin/          # Admin panel pages
│   │   ├── DashboardOverview.tsx
│   │   ├── PropertiesPage.tsx
│   │   ├── ViolationsPage.tsx
│   │   └── ...
│   ├── Auth.tsx
│   └── Index.tsx
└── integrations/
    └── supabase/           # Auto-generated client & types

supabase/
└── functions/
    ├── fetch-nyc-violations/   # Violation sync from NYC Open Data
    ├── property-ai/            # AI property assistant
    ├── lease-qa/               # Lease document Q&A
    ├── generate-dd-report/     # DD report generation
    ├── send-email-digest/      # Scheduled email summaries
    ├── send-sms/               # Twilio SMS integration
    ├── send-telegram/          # Telegram notifications
    └── scheduled-sync/         # Periodic data refresh
```

## Database Schema

### Key Tables
- `properties` — Building records with 80+ fields from PLUTO/DOB
- `violations` — DOB/ECB/HPD violations with severity, status, penalties
- `applications` — DOB job applications and permits
- `compliance_requirements` — Local law filings with deadlines
- `compliance_scores` — Calculated A–F grades per property
- `work_orders` — Remediation tasks linked to violations/vendors
- `property_documents` — Uploaded files with extracted text
- `notifications` — In-app alerts with priority levels
- `user_roles` — Role-based access (admin/user) with security-definer function
- `api_call_logs` — NYC Open Data API call metrics
- `admin_audit_log` — Admin action tracking

### Security
- Row Level Security (RLS) on all tables
- Users only see their own data
- Admin access via `has_role()` security-definer function (prevents RLS recursion)
- API log inserts open to all authenticated users; reads restricted to admins

## NYC Open Data Endpoints

| Dataset | ID | Status |
|---------|-----|--------|
| PLUTO | `64uk-42ks` | ✅ Active |
| DOB Jobs | `ic3t-wcy2` | ✅ Active |
| ECB Violations | `3h2n-5cm9` | ✅ Active |
| OATH Hearings | `jt7v-77mi` | ✅ Active |
| PAD | `bc8t-ecyu` | ❌ 403 (Feb 2026) |

All API calls are logged via `loggedFetch()` in `src/lib/api-logger.ts` and viewable in the admin panel at `/dashboard/admin/api-logs`.

## Environment Variables

Managed automatically by Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### Edge Function Secrets
- `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY` — AI features
- `RESEND_API_KEY` — Email delivery
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — SMS
- `TELEGRAM_BOT_TOKEN` — Telegram bot

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npx vitest run

# Type check
npx tsc --noEmit
```

## Admin Setup

To grant admin access, insert a row into `user_roles`:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<your-user-id>', 'admin');
```

The admin panel appears in the sidebar under "Admin" with pages for API health monitoring, user management, and user detail views.

## How can I edit this code?

**Use Lovable** — Visit [Lovable](https://lovable.dev) and start prompting. Changes are committed automatically.

**Use your preferred IDE** — Clone this repo, run `npm install` && `npm run dev`. Pushed changes sync back to Lovable.

## Deployment

Open Lovable and click Share → Publish. Custom domains can be configured under Project → Settings → Domains.

## License

Private — All rights reserved.
