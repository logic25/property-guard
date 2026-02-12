# Admin Panel: API Logging, User Management, and Remote Support

This plan covers three major capabilities you'll need as a product owner: monitoring your external API health, managing your users, and providing remote support.

---

## 1. NYC Open Data API Call Logging

### What it does

Every outgoing call to NYC Open Data (DOB Jobs, PLUTO, ECB violations, OATH hearings, etc.) gets logged with endpoint, status code, response time, and any errors. You'll see a dashboard showing:

- Real-time API health (green/yellow/red per dataset)
- Error rate trends over time (catch dataset access changes like the PAD 403 early)
- Average response times per endpoint
- Total call volume by day/week

### How it works

- A lightweight wrapper function intercepts all `fetch()` calls to `data.cityofnewyork.us` and logs results to an `api_call_logs` table
- The admin panel reads from this table with filters by endpoint, status, date range
- No impact on user-facing performance (logging is fire-and-forget)

---

## 2. User Management Panel

### What you can see and do

- **User list**: email, signup date, last active, property count, AI questions used this month
- **User detail view**: their properties, violation counts, subscription status (future Stripe), AI usage
- **Account actions**: disable/enable account, reset password (sends email), add admin notes
- **Usage analytics**: active users over time, feature adoption (who uses AI, DD reports, etc.)

### Role system

- A new `user_role` column on the `profiles` table: `owner` (default), `admin`
- Admin routes are protected -- only users with `role = 'admin'` can access `/dashboard/admin/*`
- You manually set yourself as admin via a one-time database update

---

## 3. Remote Support / "Login As User"

### What's typical in SaaS products

The industry-standard approach is called **"impersonation"** or **"login-as"**:

- Admin clicks "View as [user]" from the user management panel
- The app loads that user's data in a read-only or full-access mode
- A prominent banner shows "You are viewing as [user@email.com](mailto:user@email.com) -- Exit"
- All admin actions while impersonating are logged for audit

### How we'd implement it

- An edge function `admin-impersonate` that:
  1. Verifies the caller is an admin
  2. Generates a short-lived session token for the target user
  3. Returns it to the admin's browser
- The frontend stores the impersonation token and swaps the auth context
- A yellow banner appears at the top: "Viewing as [user@example.com](mailto:user@example.com)" with an "Exit" button
- All actions during impersonation are logged to an `admin_audit_log` table

### Privacy and trust

- Users can optionally see "An admin viewed your account on [date]" in their settings (transparency)
- Impersonation sessions auto-expire after 30 minutes
- No password access -- admins never see or use user passwords

---

## Technical Implementation Details

### New database tables

```text
api_call_logs
  - id, created_at
  - endpoint (text) -- e.g. "PLUTO", "DOB_JOBS", "ECB"
  - url (text)
  - status_code (int)
  - response_time_ms (int)
  - error_message (text, nullable)
  - property_id (uuid, nullable)
  - user_id (uuid, nullable)

admin_audit_log
  - id, created_at
  - admin_user_id (uuid)
  - action (text) -- "impersonate", "disable_user", "reset_password"
  - target_user_id (uuid)
  - metadata (jsonb)
```

### New files

```text
src/pages/dashboard/admin/
  AdminOverview.tsx        -- API health dashboard + user stats
  AdminUsersPage.tsx       -- User list with search/filter
  AdminUserDetailPage.tsx  -- Individual user deep-dive
  AdminAPILogsPage.tsx     -- API call log table with filters

src/lib/api-logger.ts     -- Wrapper that logs fetch calls

supabase/functions/admin-impersonate/index.ts  -- Impersonation token generator
```

### Route structure

```text
/dashboard/admin           -- Overview (API health + stats)
/dashboard/admin/users     -- User management
/dashboard/admin/users/:id -- User detail
/dashboard/admin/api-logs  -- API call logs
```

### Sidebar update

- New "Admin" section at bottom of sidebar (only visible to admin role users) ok what other features like billing or someting would we need?
- Icon: Shield or ShieldCheck from lucide-react

### RLS policies

- `api_call_logs`: any authenticated user can INSERT (for logging), only admins can SELECT
- `admin_audit_log`: only admins can INSERT and SELECT
- Admin check: `EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')`

---

## Implementation order

1. Add `role` column to `profiles` table + set yourself as admin
2. Create `api_call_logs` table + `api-logger.ts` wrapper
3. Wire the logger into `nyc-building-sync.ts`, `SmartAddressAutocomplete.tsx`, and edge functions
4. Build Admin API Logs page with charts
5. Create `AdminUsersPage` with user list from profiles + ai_usage
6. Build user detail view
7. Add impersonation edge function + frontend support
8. Create `admin_audit_log` table and wire up audit logging