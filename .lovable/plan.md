# Property Guard v2.0 — Gap Analysis and Implementation Plan

## Current State Summary

The project already has a solid foundation. Here is what exists versus what the spec calls for:

### Already Built (Phases 1-3 partial)


| Feature                                                                                               | Status |
| ----------------------------------------------------------------------------------------------------- | ------ |
| Properties table with NYC Open Data fields (BIN, BBL, zoning, building characteristics)               | Done   |
| Violations table (DOB, ECB, HPD, FDNY, DEP, DOT, DSNY, LPC, DOF)                                      | Done   |
| Applications table (DOB NOW, BIS, LAA)                                                                | Done   |
| DOB Complaints tracking                                                                               | Done   |
| Change log for modification tracking                                                                  | Done   |
| User authentication and RLS                                                                           | Done   |
| NYC Open Data integration (9 agencies via Socrata)                                                    | Done   |
| Scheduled sync (nightly full + 3x daily DOB quick)                                                    | Done   |
| SMS alerts via Twilio                                                                                 | Done   |
| Property detail page with tabs (Overview, Violations, Applications, Documents, Work Orders, Activity) | Done   |
| Violations with severity indicators, OATH status, agency color-coding                                 | Done   |
| Applications with status tracking                                                                     | Done   |
| Collapsible/expandable row design                                                                     | Done   |
| Search and filter functionality                                                                       | Done   |
| Age-based suppression (Phase 3A)                                                                      | Done   |
| OATH disposition reconciliation (Phase 3B)                                                            | Done   |
| Complaint category decoding (Phase 3D)                                                                | Done   |
| SWO/Vacate order detection from BIS jobs                                                              | Done   |
| FDNY compliance monitoring (refrigeration, sprinklers, standpipes, fire alarms)                       | Done   |
| Due Diligence reports (AI-generated)                                                                  | Done   |
| Lease Q&A with document intelligence                                                                  | Done   |
| Property AI chat                                                                                      | Done   |
| Email digest system                                                                                   | Done   |
| Work orders                                                                                           | Done   |
| Vendor management                                                                                     | Done   |
| Calendar page (hearings, deadlines, expirations)                                                      | Done   |
| Portfolios                                                                                            | Done   |
| Dashboard overview with stats, agency breakdown, recent violations                                    | Done   |


### Not Yet Built


| Feature                                                              | Phase | Complexity                                              |
| -------------------------------------------------------------------- | ----- | ------------------------------------------------------- |
| Local Law Applicability Engine (LL11, LL84, LL97, LL87, LL152, etc.) | 2     | Done                                                    |
| OER (Office of Environmental Remediation) tracking in Status & Restrictions | 2 | Medium — add E-designation, Phase I/II ESA status, OER enrollment |
| Tax and Protest Tracking                                             | 2     | Medium                                                  |
| Tenant Management (tags on applications)                             | 2     | Low                                                     |
| Violation-Specific Guidance templates (Phase 3C)                     | 3     | Medium (roadmapped)                                     |
| In-App Notification Center                                           | 4     | Medium - roadmap                                        |
| Priority Routing (critical/high/normal/low)                          | 4     | Medium                                                  |
| Per-Property Alert Settings                                          | 4     | Low                                                     |
| Telegram Bot Integration                                             | 4/6   | High - now and this inteact wiht the ai of the app now? |
| Violation Trend Charts                                               | 5     | Low - roadmap                                           |
| Compliance Score System (0-100)                                      | 5     | Done                                                    |
| Hearing Calendar Enhancement (detail panel, reminders)               | 5     | Medium - roadmap                                        |
| Google Calendar Integration                                          | 7     | Medium - roadmap                                        |
| Enhanced Document Intelligence (vector embeddings, RAG)              | 7     | High - roadmap i already built a rag                    |
| White Label / Multi-tenant                                           | 7     | High                                                    |


---

## Recommended Implementation Order

Given what is already built, here is the sequenced build plan, grouped into sprints:

### Sprint 1: Local Law Applicability Engine (Phase 2 gap — highest business value)

This is the biggest missing piece from Phase 2 and directly feeds the Compliance Score in Phase 5.

**Database:**

- Create `compliance_requirements` table: id, property_id (FK), local_law (text), requirement_name, cycle_year, due_date, filing_deadline, status (pending/compliant/overdue/exempt), last_filed_date, next_due_date, penalty_amount, notes, created_at, updated_at
- RLS scoped through properties.user_id

**New files:**

- `src/lib/local-law-engine.ts` — Rules for LL11 (facade/FISP), LL84 (benchmarking), LL97 (emissions), LL87 (energy audit), LL152 (gas piping), LL33/95 (inspection after gas incident), LL62 (elevators), LL77 (wind safety), LL126 (building gas detection), etc.
- Each rule: applicability check (sqft thresholds, stories, building type, has_gas, has_elevator), cycle logic (sub-cycle by last digit of block, FISP sub-cycles A/B/C), due date calculation, penalty amounts
- `getApplicableLaws(property)` returns list of requirements with status

**UI:**

- New tab or section on PropertyOverviewTab showing Local Law compliance grid
- Status badges (compliant/due soon/overdue/exempt)
- Educational tooltips explaining each law

**Sync integration:**

- Run applicability check after property data enrichment
- Upsert requirements into compliance_requirements table

### Sprint 2: Notification Center (Phase 4A + 4B)

**Database:**

- Create `notifications` table with user_id, title, body, notification_type, priority, property_id, action_url, read/dismissed status, expires_at
- RLS: users see their own; service role inserts
- Enable realtime on notifications table

**New files:**

- `src/components/NotificationBell.tsx` — Bell icon with unread badge, popover with latest 10, mark-all-read
- `src/lib/notification-priority.ts` — Priority determination (SWO/vacate = critical, new violations = high, status changes = normal)
- `src/pages/dashboard/NotificationsPage.tsx` — Full history with filters

**Updates:**

- DashboardSidebar: Add NotificationBell
- App.tsx: Add notifications route
- scheduled-sync: Create notifications after detecting changes, route by priority

### Sprint 3: Per-Property Alert Settings + Compliance Score (Phase 4C + 5B)

**Database:**

- Create `property_alert_settings` table (notify toggles, quiet hours, days-before-deadline)
- Create `compliance_scores` table (score, breakdown components, score_date)

**New files:**

- `src/lib/compliance-scoring.ts` — Score formula using violations (40pts) + Local Law compliance (40pts) + response time (20pts)

**UI:**

- PropertySettingsTab: Alert toggle switches, deadline slider, quiet hours
- PropertyOverviewTab: Compliance score card with letter grade
- DashboardOverview: Average score across portfolio
- PropertiesPage: Score column in table

### Sprint 4: Analytics + Calendar Enhancement (Phase 5A + 5C)

**New files:**

- `src/components/dashboard/ViolationTrendChart.tsx` — recharts LineChart, 12-month rolling, by severity

**Database:**

- Create `hearing_calendar` table for detailed hearing tracking with reminder flags

**Updates:**

- DashboardOverview: Add trend chart card
- CalendarPage: Click-to-detail panel, "Today" button, stats bar
- scheduled-sync: Upsert hearing_calendar entries, create reminder notifications at 7/3/1 days

### Sprint 5: Tax Tracking + Tenant Management (Phase 2 gaps)

**Database:**

- Create `property_taxes` table: property_id, tax_year, amount, payment_date, tenant_responsible, protest_status, attorney, notes
- Add tenant_name column to applications table

**UI:**

- PropertyOverviewTab: Tax history section with protest status
- ApplicationsPage: Tenant name column and filter

### Sprint 6: Telegram Bot (Phase 6) — now

**Backend:**

- New edge function `telegram-webhook/index.ts` for incoming messages
- New edge function `send-telegram/index.ts` for outgoing messages
- AI-powered intent parsing using supported models (Gemini)
- Bot registration with BotFather

**Database:**

- Create `telegram_users` table linking Telegram chat_id to user_id
- Add telegram_chat_id to notification delivery

**Features:**

- Query violations, compliance, hearings by property
- Daily/weekly digest via Telegram
- Group chat coordination

### Sprint 7: Advanced Features (Phase 7) — Future

- Google Calendar OAuth integration
- Enhanced document intelligence (vector embeddings)
- White label / multi-tenant architecture

---

## Technical Notes

- All new tables follow existing RLS patterns (scoped through properties.user_id or direct user_id = auth.uid())
- No new API keys needed for Sprints 1-5 (all NYC Open Data APIs are free)
- Telegram Bot (Sprint 6) will need a TELEGRAM_BOT_TOKEN secret
- Local Law engine is the critical dependency for Compliance Scoring — must be built first
- Recharts is already installed for trend charts
- Realtime can be enabled on notifications table for instant updates
- Compliance scores recalculated during nightly sync