

## Applications Tab Improvements

### Issues Found

1. **No `job_description` in DOB NOW Build API** -- Confirmed via direct API query that the column does not exist in the `w9ak-ipjd` dataset. The DOB BIS dataset (`ic3t-wcy2`) does have `job_description`. For Build applications, the best we can show is the work location and building type already captured.

2. **`apt_condo_no_s` is always null** for this property's Build applications -- the API returns no records with that field populated for BIN 3082625. The field mapping in the edge function is correct (`a.apt_condo_no_s`), but the data simply doesn't exist for these filings. No code fix needed.

3. **No open count on the Applications tab trigger** -- The tab just says "Applications" with no count.

4. **No source filter or grouping** -- All 59 applications are in one flat list mixing BIS, Build, Limited Alt, Electrical, Elevator.

5. **P1/P2/P3 relationship to I1 not shown** -- e.g. `X08023336-I1`, `X08023336-P1`, `X08023336-P2`, `X08023336-P3` are related filings (P = subsequent/partial permits under the initial I1 filing) but this isn't indicated.

6. **Notes field requested** -- User wants a collapsible notes section within the expanded row.

---

### Plan

#### 1. Add Source Filter (multi-select like status filter)
- Add a source multi-select popover filter alongside the existing agency and status filters
- Sources: DOB BIS, DOB NOW Build, DOB NOW Limited Alt, DOB NOW Electrical, DOB NOW Elevator
- Default: all selected

#### 2. Group Related Filings (I1/P1/P2/P3)
- Parse the job number prefix (e.g. `X08023336`) and suffix (`I1`, `P1`, `P2`)
- Show I1 (initial) as the parent row; P-filings indented or nested beneath it
- Add a small label like "Initial Filing" / "Subsequent (P1)" in the table row to clarify relationships

#### 3. Show Open/Active Count on Tab
- In `PropertyDetailPage.tsx`, query or derive the count of non-completed applications
- Display like: `Applications (14)` on the tab trigger (similar to how violations count is shown)

#### 4. Add Notes Field
- Add a collapsible "Notes" text area inside the expanded detail row
- Store notes in the `applications` table (requires adding a `notes` text column via migration)
- Allow inline editing and saving

#### 5. Confirm Data Limitations to User
- DOB NOW Build does NOT have `job_description` -- this is an API limitation
- `apt_condo_no_s` exists but is null for this property's filings
- `applicant_phone`, `applicant_email`, `applicant_business_name` are also not provided by the API for these records (the fields exist but are empty)

---

### Technical Details

**Database Migration:**
```sql
ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes text;
```

**PropertyDetailPage.tsx changes:**
- Add application count to the Applications tab trigger, counting non-completed/signed-off apps

**PropertyApplicationsTab.tsx changes:**
- Add a source multi-select filter popover (same pattern as the status filter)
- Group applications by job number prefix: parse `X08023336` from `X08023336-I1` and group I/P filings together
- Show I1 rows normally; P-rows indented with a "Subsequent" badge
- Add a collapsible notes textarea inside the expanded detail row with save functionality
- Add source filter to the filter bar

**Edge function:** No changes needed -- the field mappings are correct, the API just doesn't provide `job_description` or populated `apt_condo_no_s` for these particular records.

