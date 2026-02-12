# Phase 3-5 Implementation Plan: Intelligence, Notifications, and Analytics

## Parked Items (for later)

- **Properties page styling**: Tone down the aggressive header/table styling to something more balanced
- **CO PDF download**: BIS blocks server-side requests with 403; investigate Firecrawl or browser-based scraping alternatives

---

## Phase 3: Smarter Violation Intelligence

### 3A. Age-Based Suppression - yes but add to roadmap to revisit later as we may have to modify

**Database migration:**

- Add `suppressed` (boolean, default false) and `suppression_reason` (text) columns to `violations` table

**New file:** `src/lib/violation-aging.ts`

- Aging rules: ECB > 2 years, DOB > 3 years, HPD > 3 years
- `shouldSuppressViolation()` function checking issue date against rules
- Only applies to violations with status "open"

**Edge function update:** `scheduled-sync/index.ts`

- After sync completes, run suppression check on all open violations for the property

**UI updates:**

- `PropertyViolationsTab.tsx`: Add "Show suppressed" toggle alongside the Active/All toggle
- Suppressed violations shown with muted styling + "Suppressed" badge with tooltip explaining why
- `ViolationsPage.tsx`: Same toggle treatment
- Update `isActiveViolation()` in `violation-utils.ts` to exclude suppressed violations

### 3B. OATH Disposition Reconciliation

**Database migration:**

- Create `oath_hearings` table: id, summons_number (unique), hearing_date, hearing_status, disposition, disposition_date, penalty_amount, penalty_paid, violation_id (FK), property_id (FK), last_synced_at, created_at, updated_at
- RLS: SELECT/INSERT/UPDATE through properties.user_id join; service role INSERT/UPDATE for sync
- Indexes on summons_number, violation_id, property_id

**Edge function update:** `fetch-nyc-violations/index.ts`

- The OATH dataset is already queried for FDNY/DEP/DOT/DSNY/LPC/DOF violations
- Add a post-sync step: for each ECB violation, query OATH API by violation_number
- Upsert into `oath_hearings`
- If disposition is "Dismissed" or "Not Guilty", auto-update violation status to "closed" and log to `change_log`

**UI updates:**

- `PropertyViolationsTab.tsx` expanded row: Show OATH hearing card when available (hearing date, status, disposition, penalty)
- Color-coded disposition badges (green for dismissed, red for guilty, yellow for default)

### 3C. Violation-Specific Guidance (What This Means) - i think our email has this we kist need to refine and can be roadmapped

**New file:** `src/lib/violation-guidance.ts`

- Template map keyed by violation pattern (structural, work without permit, illegal conversion, elevator, boiler, facade, complaint)
- Each template: severity, whatItMeans, immediateActions[], timeline, typicalCost, whoToCall, preventionTips[]
- `getViolationGuidance()` function matching violation description/category to templates

**UI updates:**

- `PropertyViolationsTab.tsx` expanded row: Add "What To Do" section below existing "What This Means" decode
- Card layout with immediate actions checklist, timeline, cost estimate, who to call
- Only shows when guidance match is found

**Email integration:**

- Update `send-email-digest` edge function to include guidance content for new violations in digest emails

### 3D. Complaint Category Decoding - yes look at the glossary to decode the complaints

**New file:** `src/lib/complaint-category-decoder.ts`

- Map of DOB complaint codes to human-readable names: 4B = Illegal Conversion, 77 = Work Without Permit, 3A = Unsafe Structure, etc.
- `decodeComplaintCategory()` function

**UI updates:**

- `PropertyViolationsTab.tsx`: Where `complaint_category` is displayed, show decoded name + description
- `ViolationsPage.tsx`: Same treatment in expanded rows

---

## Phase 4: Notifications and Alerts

### 4A. In-App Notification Center

**Database migration:**

- Create `notifications` table: id, user_id (uuid, not FK to auth), title, body, notification_type, priority (critical/high/normal/low), property_id, related_entity_type, related_entity_id, action_url, read (default false), read_at, dismissed (default false), dismissed_at, sent_via_email, created_at, expires_at
- RLS: Users can SELECT/UPDATE their own notifications (user_id = auth.uid()); service role can INSERT
- Indexes on user_id, read (partial where false), created_at DESC, priority

**New file:** `src/components/NotificationBell.tsx`

- Bell icon with unread count badge in sidebar header
- Popover dropdown showing latest 10 notifications
- Priority color dot per notification
- "Mark all read" button
- Click notification to navigate to action_url
- Poll every 30 seconds for new notifications (or use Supabase realtime)

**Sidebar update:** `DashboardSidebar.tsx`

- Add NotificationBell component next to the logo area

**New page:** `src/pages/dashboard/NotificationsPage.tsx`

- Full notification history with filters (by type, priority, read/unread)
- Add route to App.tsx

### 4B. Priority Routing

**New file:** `src/lib/notification-priority.ts`

- `determineNotificationPriority()`: stop work/vacate/emergency = critical; new violations/hearings = high; status changes = normal; informational = low
- `routeNotification()`: creates notification record; triggers email for critical/high via existing `send-email-digest` infrastructure

**Edge function update:** `scheduled-sync/index.ts`

- After detecting changes, call priority routing to create notifications
- Critical items trigger immediate email via `send-change-summary`

### 4C. Per-Property Alert Settings

**Database migration:**

- Create `property_alert_settings` table: id, property_id (FK), user_id, notify_all_violations, notify_only_critical, notify_status_changes, notify_new_applications, notify_compliance_deadlines, days_before_deadline_alert (default 30), quiet_hours_start, quiet_hours_end, created_at, updated_at
- UNIQUE on (property_id, user_id)
- RLS through properties.user_id

**UI:** Add "Alert Settings" section to `PropertySettingsTab.tsx`

- Toggle switches for each notification type
- Days-before-deadline slider
- Quiet hours time pickers

---

## Phase 5: Analytics and Reporting

### 5A. Violation Trend Charts - roadmap

**UI updates:** `DashboardOverview.tsx`

- Add a "Violation Trends" card using recharts (already installed)
- LineChart showing monthly violation counts over last 12 months
- Lines for total, critical, and resolved
- Query violations grouped by month from issued_date

**New file:** `src/components/dashboard/ViolationTrendChart.tsx`

- Reusable chart component accepting property_id (optional, for property-level or portfolio-level)

### 5B. Compliance Score - this compliance score should be based on if the property is in compliance with LL and violations. Do you have the LL logic that we need

**Database migration:**

- Create `compliance_scores` table: id, property_id (FK), score (0-100), score_date, violations_score, compliance_score, response_time_score, total_violations, critical_violations, overdue_compliance_count, avg_resolution_days, created_at
- UNIQUE on (property_id, score_date)
- RLS through properties.user_id

**New file:** `src/lib/compliance-scoring.ts`

- Score formula: violations (0-40) + compliance (0-40) + response time (0-20)
- Deductions per critical (-10), high (-5), other (-2)
- Overdue requirements (-5 each)
- Slow response time penalties

**Edge function update:** `scheduled-sync/index.ts`

- After sync, calculate and store compliance score for each property

**UI updates:**

- `PropertyOverviewTab.tsx`: Add compliance score card with letter grade (A-F), breakdown bars
- `DashboardOverview.tsx`: Show average compliance score across portfolio
- `PropertiesPage.tsx`: Add score column to properties table

### 5C. Hearing Calendar Enhancement

The existing `CalendarPage.tsx` already shows hearings, cure deadlines, certifications, permit expirations, document expirations, and work orders. Enhancements:

**Database migration:**

- Create `hearing_calendar` table: id, property_id, hearing_type, hearing_date, hearing_time, hearing_location, case_number, violation_id (FK), status, outcome, reminder_7_days, reminder_3_days, reminder_1_day, notes, created_at, updated_at
- RLS through properties.user_id

**Edge function update:** `scheduled-sync/index.ts`

- When violations with hearing_date are synced, upsert into hearing_calendar
- Check for upcoming hearings and create reminder notifications at 7/3/1 days

**UI updates:**

- `CalendarPage.tsx`: Click event to open detail panel with full info + property link
- Add "Today" quick-nav button
- Mini stats bar at top (total hearings this month, expiring permits, overdue items)

---

## Implementation Sequence

1. **Phase 3A + 3D** (suppression + complaint decoding) -- pure client-side logic, no API calls needed
2. **Phase 3B** (OATH reconciliation) -- extends existing sync; database + edge function changes
3. **Phase 3C** (violation guidance) -- new utility file + UI cards
4. **Phase 4A** (notification center) -- database + new component + sidebar update
5. **Phase 4B + 4C** (priority routing + per-property settings) -- builds on 4A
6. **Phase 5A** (trend charts) -- recharts already installed, client-side aggregation
7. **Phase 5B** (compliance score) -- database + scoring logic + UI cards
8. **Phase 5C** (hearing calendar enhancement) -- extends existing calendar page

## Technical Notes

- All new tables get RLS policies scoped through `properties.user_id` or direct `user_id = auth.uid()`
- Notifications table needs service role INSERT policy for sync functions
- OATH API (data.cityofnewyork.us) is free, no API key needed, 1000 req/hr
- Realtime can be enabled on `notifications` table for instant bell updates (optional, polling works fine for MVP)
- Compliance scores recalculated during nightly sync to avoid stale data
- No new secrets required -- all APIs are public NYC Open Data endpoints