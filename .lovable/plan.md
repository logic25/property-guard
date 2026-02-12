# Property Guard: Prioritized Build Plan

This plan consolidates everything you've asked for -- the master prompt features, email digest, calendar enhancements, team chat, contractor monitoring, and application sync notifications -- into a single prioritized roadmap. Each phase builds on the previous one so nothing breaks.

---

## Priority Order (Why This Sequence)

1. **Email System + Notifications** -- Immediate user value; every other feature benefits from having email infrastructure in place
2. **Application Sync + Change Detection** -- Critical data gap; applications don't auto-sync like violations do
3. **Calendar Enhancements + Follow-up Tracking** -- Builds on existing calendar; adds actionable follow-up with saved messages
4. **Team Chat (PropertyAI upgrade)** -- Transforms PropertyAI into collaborative tool with @mentions and AI toggle
5. **FDNY Compliance System** -- New data domain; database + detection + UI tab
6. **Tax Tracking** -- Simple CRUD feature; low complexity
7. **Contractor Monitoring** -- Requires cross-referencing DOB data; most complex new data pipeline
8. **Telegram Bot** -- External integration; requires bot token setup; lowest priority per "don't build until users ask"

---

## Phase 1: Email Digest + Notification System

### Database Changes

- `email_preferences` table: user_id, digest_frequency (weekly/daily/none), digest_day (Monday default), notify_new_violations, notify_status_changes, notify_expirations, notify_new_applications, email (from auth)
- `email_log` table: id, user_id, email_type, subject, sent_at, metadata (jsonb)

### Edge Function: `send-email-digest`

- Query all properties for the user
- Gather: new violations since last digest, upcoming hearings/deadlines (7 days), expiring permits/documents, application status changes
- Format into a beautiful HTML email using inline CSS (clean, card-based layout with color-coded severity)
- Send via Resend API (will need RESEND_API_KEY secret)
- Log to email_log table

### Edge Function: `send-notification-email`

- Triggered by sync functions when changes detected
- Sends immediate alert emails for critical items (stop work orders, vacate orders, new violations)
- Batches non-critical changes into a summary

### UI: Email Preferences (Settings page)

- Toggle: Weekly digest on/off
- Checkboxes: What to include (violations, applications, expirations, hearings)
- "Send Test Email" button so you can preview the template
- Email preview modal showing exactly what the digest looks like

### Email Template Design

- Header: Property Guard logo + "Weekly Compliance Digest"
- Section per property with active issues
- Color-coded cards: red (critical), orange (high), yellow (medium), blue (info)
- Action links back to the app for each item
- Footer with unsubscribe link

---

## Phase 2: Application Sync + Change Notifications

### Update `scheduled-sync` edge function

- Add application syncing alongside violation syncing
- Track previous status in `applications.raw_data` to detect changes
- When status changes detected, call `send-notification-email` with change details

### Update `fetch-nyc-violations` edge function

- Already fetches applications; enhance to compare old vs new status
- Return `changed_applications` count alongside `new_applications`
- Store previous status snapshot for diff comparison

### Auto-attach permits and COs

- When sync finds a new CO or permit status change, create entry in `property_documents` automatically
- Link document to the application record via metadata - it would be great if we could attach th actual file to the emial
- Document type: "auto-synced-permit" or "auto-synced-co"

---

## Phase 3: Calendar Enhancements + Follow-up Tracking

### Database Changes

- `calendar_follow_ups` table: id, user_id, event_type, event_id (violation/application/document UUID), property_id, message, created_at, resolved_at, resolved_by

### Calendar UI Updates

- Click any event card to open a detail panel
- Detail panel shows: full event info, property link, "Add Follow-up" button
- Follow-up form: text message saved to `calendar_follow_ups`
- Show follow-up history on the card
- Add "Today" button and mini-stats bar (total hearings, expiring permits, overdue items)
- Include ALL violations, permits, document expirations on the calendar, also work order due dates( need to expand work orders)
- Filter by property, by type, by urgency

---

## Phase 4: Team Chat (PropertyAI Upgrade)

### Database Changes

- Add `mentioned_user_id` (nullable UUID) to `property_ai_messages`
- Add `is_ai_response` (boolean, default true) to `property_ai_messages`
- `property_members` table already exists -- reuse for @mention targets

### PropertyAI Widget Changes

- Rename to "Property Chat" in UI
- Add @mention autocomplete: typing `@` shows list of property members
- When message has NO @mention: send to AI as before (is_ai_response = true on reply)
- When message HAS @mention: save as human message (is_ai_response = false), no AI call
- Mentioned users see notification badge on the property
- Any user can type `@AI` to explicitly invoke AI in the thread - but they see the full chat history
- Thread is shared across all property members (already scoped by property_id)

---

## Phase 5: FDNY Compliance System

### Database Changes (from master prompt)

- `fdny_equipment` table (refrigeration, sprinklers, standpipes, fire alarms)
- `fire_alarm_incidents` table
- `fdny_compliance_alerts` table
- RLS policies scoped through properties.user_id

### New Files

- `src/lib/fdnyEquipmentDetection.ts` -- rule-based detection from building class/occupancy
- `src/lib/fdnyComplianceChecker.ts` -- checks equipment records against requirements
- `src/components/properties/detail/PropertyFDNYTab.tsx` -- equipment list, alerts, compliance check button

### Property Detail Page

- Add "FDNY" tab (9th tab, between Work Orders and Activity)
- Show equipment cards with permit status badges
- "Check Compliance" button runs checker and displays alerts
- Add FDNY deadlines to Calendar

---

## Phase 6: Tax Tracking

### Database Changes

- `property_taxes` table (from master prompt)
- Add `tenant_name`, `tenant_notes` columns to `applications` table

### New Files

- `src/components/properties/detail/PropertyTaxTab.tsx` -- tax year form, payment tracking, protest tracking
- Tax alerts component showing overdue/unfiled protests

### Property Detail Page

- Add "Taxes" tab
- Tenant tags on application expanded rows

---

## Phase 7: Contractor Monitoring - these are vendors so we need to expand vendors

### Database Changes

- `contractors` table: id, user_id, name, license_number, license_type, insurance_expiration, dob_violations_count, last_checked_at
- `application_contractors` junction table: application_id, contractor_id

### Edge Function: `check-contractor-compliance`

- Cross-reference contractor license numbers against DOB violation datasets
- Check insurance expiration dates
- Generate alerts for expired insurance or contractors with violations

### UI

- Contractor list page (or section in Vendors)
- Link contractors to applications
- Alert badges when insurance expiring or DOB violations found

---

## Phase 8: Telegram Bot (Future)

### Requirements

- TELEGRAM_BOT_TOKEN secret
- Edge function: `telegram-webhook`
- Uses Lovable AI (gemini-2.5-flash) instead of Anthropic for natural language parsing
- Database tables: `messaging_users`, `message_conversations`, `telegram_groups`
- Webhook handler for inbound messages, property lookup, data queries

This phase is deferred until after real user feedback on Phases 1-7.

---

## Technical Notes

- **Email provider**: Will need a Resend API key (free tier: 100 emails/day, plenty for MVP)
- **No Next.js**: All backend logic runs as Supabase Edge Functions (Deno), not Next.js API routes as shown in the master prompt
- **AI model**: Team chat and Telegram will use Lovable AI (gemini-2.5-flash) -- no additional API keys needed
- **Existing functionality preserved**: All current violations, applications, documents, work orders, PropertyAI continue working unchanged
- **Property Detail tabs**: Will grow from 7 to 9 tabs (adding FDNY + Taxes); tab bar will need horizontal scroll on mobile

---

## First Implementation Step

Once approved, I'll start with **Phase 1**: create the `email_preferences` and `email_log` tables, build the `send-email-digest` edge function with a beautiful HTML template, add email settings to the Settings page, and wire up a "Send Test Email" button so you can see exactly what the digest looks like.