import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// NYC Open Data API endpoints (Socrata) - No API key needed, 1000 req/hr limit
const NYC_OPEN_DATA_ENDPOINTS = {
  DOB_OLD: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json",
  DOB_NEW: "https://data.cityofnewyork.us/resource/855j-jady.json",
  ECB: "https://data.cityofnewyork.us/resource/6bgk-3dad.json",
  HPD: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
  // OATH Hearings Division - main dataset for ALL agency violations
  OATH_HEARINGS: "https://data.cityofnewyork.us/resource/jz4z-kudi.json",
  // Additional agency datasets
  DEP: "https://data.cityofnewyork.us/resource/xbs2-bdct.json", // DEP Notices of Violation
  DOT: "https://data.cityofnewyork.us/resource/w286-9scw.json", // DOT Violations
  DSNY: "https://data.cityofnewyork.us/resource/erm2-nwe9.json", // 311 DSNY complaints (proxy)
  LPC: "https://data.cityofnewyork.us/resource/wyev-xvpj.json", // Landmarks violations
  DOF: "https://data.cityofnewyork.us/resource/bnx9-e6tj.json", // DOF Property Tax Liens
  CO: "https://data.cityofnewyork.us/resource/bs8b-p36w.json",
};

// Agency name mappings for OATH dataset
const OATH_AGENCY_NAMES: Record<string, string> = {
  FDNY: "FIRE DEPARTMENT OF NYC",
  DEP: "DEPT OF ENVIRONMENT PROT",
  DOT: "DEPT OF TRANSPORTATION",
  DSNY: "DEPT OF SANITATION",
  LPC: "LANDMARKS PRESERV COMM",
  DOF: "DEPT OF FINANCE",
};

type AgencyType = "DOB" | "ECB" | "FDNY" | "HPD" | "DEP" | "DOT" | "DSNY" | "LPC" | "DOF";

interface ViolationRecord {
  agency: AgencyType;
  violation_number: string;
  issued_date: string;
  hearing_date: string | null;
  cure_due_date: string | null;
  description_raw: string | null;
  property_id: string;
  severity: string | null;
  violation_class: string | null;
  violation_type: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  penalty_amount: number | null;
  respondent_name: string | null;
  synced_at: string;
  source?: string;
  oath_status?: string | null;
  status: 'open' | 'in_progress' | 'closed';
}

// Extract violation type from description or category
function extractViolationType(description: string | null, category: string | null, agency: string): string | null {
  const text = `${description || ''} ${category || ''}`.toLowerCase();
  
  // Elevator-related
  if (text.includes('elevator') || text.includes('ftc') || text.includes('ftf') || 
      text.includes('escalator') || text.includes('convey') || text.includes('lift')) {
    return 'elevator';
  }
  // Plumbing
  if (text.includes('plumb') || text.includes('water') || text.includes('sewer') || 
      text.includes('drain') || text.includes('pipe') || text.includes('backflow')) {
    return 'plumbing';
  }
  // Electrical
  if (text.includes('electric') || text.includes('wiring') || text.includes('outlet') || 
      text.includes('circuit') || text.includes('panel') || text.includes('volt')) {
    return 'electrical';
  }
  // Fire safety
  if (text.includes('fire') || text.includes('sprinkler') || text.includes('smoke') || 
      text.includes('alarm') || text.includes('extinguish') || text.includes('egress') ||
      agency === 'FDNY') {
    return 'fire_safety';
  }
  // Structural
  if (text.includes('structur') || text.includes('foundation') || text.includes('beam') || 
      text.includes('column') || text.includes('load') || text.includes('crack') ||
      text.includes('facade') || text.includes('parapet') || text.includes('ll11')) {
    return 'structural';
  }
  // Construction/permits
  if (text.includes('permit') || text.includes('work without') || text.includes('construction') ||
      text.includes('alteration') || text.includes('demolition')) {
    return 'construction';
  }
  // HVAC/Boiler
  if (text.includes('boiler') || text.includes('hvac') || text.includes('heating') || 
      text.includes('ventilat') || text.includes('air condition') || text.includes('gas')) {
    return 'hvac';
  }
  // Housing/maintenance (HPD)
  if (text.includes('maint') || text.includes('repair') || text.includes('paint') ||
      text.includes('lead') || text.includes('mold') || text.includes('pest') ||
      text.includes('rodent') || text.includes('vermin') || agency === 'HPD') {
    return 'housing';
  }
  // Sanitation
  if (text.includes('sanit') || text.includes('garbage') || text.includes('trash') ||
      text.includes('refuse') || text.includes('recycl') || agency === 'DSNY') {
    return 'sanitation';
  }
  // Landmarks
  if (text.includes('landmark') || text.includes('historic') || text.includes('preserv') ||
      agency === 'LPC') {
    return 'landmarks';
  }
  // Environmental
  if (text.includes('environ') || text.includes('asbestos') || text.includes('hazard') ||
      text.includes('pollut') || agency === 'DEP') {
    return 'environmental';
  }
  // Signage
  if (text.includes('sign') || text.includes('billboard') || text.includes('awning')) {
    return 'signage';
  }
  // Zoning
  if (text.includes('zoning') || text.includes('certificate of occupancy') || text.includes('c of o') ||
      text.includes('use group') || text.includes('occupancy')) {
    return 'zoning';
  }
  
  return 'other';
}

// Statuses that indicate a violation is resolved/closed
const CLOSED_STATUSES = [
  'WRITTEN OFF', 'CLOSED', 'DISMISSED', 'PAID', 'RESOLVED', 'COMPLIED',
  'SETTLED', 'SATISFIED', 'VACATED', 'WAIVED', 'NO PENALTY', 'DEFAULT - PAID'
];

async function sendSMSAlert(
  supabaseUrl: string,
  supabaseServiceKey: string,
  to: string,
  message: string
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ to, message }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("SMS send failed:", error);
    } else {
      console.log("SMS alert sent successfully");
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bin, bbl, property_id, applicable_agencies, send_sms_alert } = await req.json();

    if (!bin && !bbl) {
      throw new Error("BIN or BBL is required");
    }

    // Parse BBL into components for OATH lookups
    let borough = "";
    let block = "";
    let lot = "";
    if (bbl && bbl.length >= 10) {
      borough = bbl.charAt(0);
      block = bbl.substring(1, 6);
      lot = bbl.substring(6, 10);
    }

    console.log(`Fetching violations for BIN: ${bin}, BBL: ${bbl} (Borough: ${borough}, Block: ${block}, Lot: ${lot}), Agencies: ${(applicable_agencies || []).join(', ')}`);

    const violations: ViolationRecord[] = [];
    const agenciesToSync: string[] = applicable_agencies || ["DOB", "ECB"];
    const now = new Date().toISOString();

    const safeFetch = async (url: string, agency: string): Promise<unknown[]> => {
      try {
        console.log(`Fetching ${agency}: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`${agency} API error: ${response.status}`);
          return [];
        }
        return await response.json();
      } catch (error) {
        console.error(`${agency} fetch error:`, error);
        return [];
      }
    };

    const boroughNames: Record<string, string> = {
      "1": "MANHATTAN",
      "2": "BRONX",
      "3": "BROOKLYN",
      "4": "QUEENS",
      "5": "STATEN ISLAND",
    };
    const boroughName = boroughNames[borough] || "";

    // Helper to fetch violations from OATH dataset for a specific agency
    const fetchOATHViolations = async (agency: AgencyType): Promise<void> => {
      if (!borough || !block || !lot || !boroughName) {
        console.log(`${agency}: Skipped - requires valid BBL for OATH lookup`);
        return;
      }

      const oathAgencyName = OATH_AGENCY_NAMES[agency];
      if (!oathAgencyName) {
        console.log(`${agency}: No OATH agency mapping found`);
        return;
      }

      const data = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.OATH_HEARINGS}?issuing_agency=${encodeURIComponent(oathAgencyName)}&violation_location_borough=${encodeURIComponent(boroughName)}&violation_location_block_no=${block}&violation_location_lot_no=${lot}&$limit=100&$order=violation_date DESC`,
        `${agency}/OATH`
       );
 
       console.log(`Found ${data.length} ${agency} violations from OATH Hearings`);
       if (data.length > 0) {
         const sample = data[0] as Record<string, unknown>;
         console.log(
           `${agency}/OATH sample keys: ${Object.keys(sample).slice(0, 40).join(", ")}`
         );
         console.log(
           `${agency}/OATH sample status fields: ${JSON.stringify({
             hearing_status: sample.hearing_status,
             violation_status: sample.violation_status,
             status: sample.status,
             case_status: sample.case_status,
             record_status: sample.record_status,
             summons_status: sample.summons_status,
             disposition: sample.disposition,
             outcome: sample.outcome,
           })}`
         );
       }
 
       for (const v of data as Record<string, unknown>[]) {
          const violationNum = v.ticket_number as string;
          const issueDate = v.violation_date as string;

          // Combine multiple OATH fields so values like "Written Off" aren't lost.
          const oathStatus = [
            v.hearing_status,
            v.hearing_result,
            v.compliance_status,
            v.violation_status,
            v.status,
          ]
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter(Boolean)
            .join(' | ');

        if (violationNum && issueDate) {
          // Determine if violation is closed based on OATH status
          const isResolved = CLOSED_STATUSES.some(s => 
            oathStatus.toUpperCase().includes(s)
          );

          const description = [
            v.charge_1_code_description,
            v.charge_2_code_description,
            v.charge_3_code_description,
          ].filter(Boolean).join("; ") || `${agency} Violation`;

          const violationClass = (v.charge_1_code || v.charge_1_code_section) as string || null;
          violations.push({
            agency,
            violation_number: String(violationNum),
            issued_date: issueDate.split("T")[0],
            hearing_date: v.hearing_date ? (v.hearing_date as string).split("T")[0] : null,
            cure_due_date: null,
            description_raw: description,
            property_id,
            severity: agency === "FDNY" || agency === "LPC" ? "critical" : "medium",
            violation_class: violationClass,
            violation_type: extractViolationType(description, violationClass, agency),
            is_stop_work_order: false,
            is_vacate_order: false,
            penalty_amount: v.penalty_imposed ? parseFloat(v.penalty_imposed as string) :
                           v.total_violation_amount ? parseFloat(v.total_violation_amount as string) : null,
            respondent_name: v.respondent_last_name ?
              `${v.respondent_first_name || ""} ${v.respondent_last_name}`.trim() : null,
            synced_at: now,
            source: "oath",
            oath_status: oathStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    };

    // Fetch DOB Violations
    if (agenciesToSync.includes("DOB")) {
      const [dobOldData, dobNewData] = await Promise.all([
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_OLD}?bin=${bin}&$limit=100&$order=issue_date DESC`, "DOB_OLD"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NEW}?bin=${bin}&$limit=100&$order=violation_issue_date DESC`, "DOB_NEW"),
      ]);

      console.log(`Found ${dobOldData.length} DOB (old) violations, ${dobNewData.length} DOB (new) violations`);

      for (const v of dobOldData as Record<string, unknown>[]) {
        const violationNum = (v.violation_number || v.ecb_violation_number || v.number) as string;
        const issueDate = v.issue_date as string;
        const dobStatus = (v.disposition_status || v.status || "") as string;

        if (violationNum && issueDate) {
          const isResolved = CLOSED_STATUSES.some(s => 
            dobStatus.toUpperCase().includes(s)
          ) || dobStatus.toUpperCase().includes('CURED') || dobStatus.toUpperCase().includes('COMPLIED');

          const descRaw = (v.description || v.violation_category || v.violation_type) as string || null;
          const violClass = (v.violation_category || v.class) as string || null;
          violations.push({
            agency: "DOB",
            violation_number: violationNum,
            issued_date: issueDate.split("T")[0],
            hearing_date: null,
            cure_due_date: null,
            description_raw: descRaw,
            property_id,
            severity: (v.violation_type || v.severity) as string || null,
            violation_class: violClass,
            violation_type: extractViolationType(descRaw, violClass, "DOB"),
            is_stop_work_order: String(v.disposition_comments || "").toLowerCase().includes("stop work"),
            is_vacate_order: String(v.disposition_comments || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed as string) : null,
            respondent_name: (v.respondent_name || v.owner) as string || null,
            synced_at: now,
            source: "dob_bis",
            oath_status: dobStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }

      for (const v of dobNewData as Record<string, unknown>[]) {
        const violationNum = v.violation_number as string;
        const issueDate = v.violation_issue_date as string;
        const dobStatus = (v.disposition_status || v.status || "") as string;

        if (violationNum && issueDate) {
          const isResolved = CLOSED_STATUSES.some(s => 
            dobStatus.toUpperCase().includes(s)
          ) || dobStatus.toUpperCase().includes('CURED') || dobStatus.toUpperCase().includes('COMPLIED');

          const descRawNew = (v.violation_description || v.violation_type) as string || null;
          const violClassNew = v.violation_category as string || null;
          violations.push({
            agency: "DOB",
            violation_number: violationNum,
            issued_date: issueDate.split("T")[0],
            hearing_date: null,
            cure_due_date: v.cure_date ? (v.cure_date as string).split("T")[0] : null,
            description_raw: descRawNew,
            property_id,
            severity: v.violation_type as string || null,
            violation_class: violClassNew,
            violation_type: extractViolationType(descRawNew, violClassNew, "DOB"),
            is_stop_work_order: String(v.violation_description || "").toLowerCase().includes("stop work"),
            is_vacate_order: String(v.violation_description || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penalty_amount ? parseFloat(v.penalty_amount as string) : null,
            respondent_name: v.respondent_name as string || null,
            synced_at: now,
            source: "dob_now",
            oath_status: dobStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    }

    // Fetch ECB Violations
    if (agenciesToSync.includes("ECB")) {
      const ecbData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.ECB}?bin=${bin}&$limit=100&$order=issue_date DESC`,
        "ECB"
      );

      console.log(`Found ${ecbData.length} ECB violations`);

      for (const v of ecbData as Record<string, unknown>[]) {
        const violationNum = v.ecb_violation_number as string;
        const issueDate = v.issue_date as string;
        const ecbStatus = (v.ecb_violation_status || v.status || "") as string;

        if (violationNum && issueDate) {
          const isResolved = CLOSED_STATUSES.some(s => 
            ecbStatus.toUpperCase().includes(s)
          ) || ecbStatus.toUpperCase().includes('RESOLVE') || ecbStatus.toUpperCase().includes('CERTIF');

          const ecbDescRaw = (v.violation_description || v.infraction_code1) as string || null;
          violations.push({
            agency: "ECB",
            violation_number: violationNum,
            issued_date: issueDate.split("T")[0],
            hearing_date: v.scheduled_hearing_date ? (v.scheduled_hearing_date as string).split("T")[0] : null,
            cure_due_date: null,
            description_raw: ecbDescRaw,
            property_id,
            severity: (v.severity || v.aggravated_level) as string || null,
            violation_class: null,
            violation_type: extractViolationType(ecbDescRaw, null, "ECB"),
            is_stop_work_order: false,
            is_vacate_order: false,
            penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed as string) : null,
            respondent_name: v.respondent_name as string || null,
            synced_at: now,
            source: "ecb",
            oath_status: ecbStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    }

    // Fetch HPD Violations
    if (agenciesToSync.includes("HPD") && bbl) {
      const hpdData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.HPD}?bbl=${bbl}&$limit=100&$order=inspectiondate DESC`,
        "HPD"
      );

      console.log(`Found ${hpdData.length} HPD violations`);

      for (const v of hpdData as Record<string, unknown>[]) {
        const violationNum = v.violationid as string;
        const issueDate = v.inspectiondate as string;
        const hpdStatus = (v.currentstatus || v.status || "") as string;

        if (violationNum && issueDate) {
          // HPD uses different status terms
          const isResolved = hpdStatus.toUpperCase().includes('CERTIF') || 
                            hpdStatus.toUpperCase().includes('CLOSED') ||
                            hpdStatus.toUpperCase().includes('DISMISS');

          const hpdDescRaw = (v.novdescription || v.novissueddate) as string || null;
          const hpdClass = v.class as string || null;
          violations.push({
            agency: "HPD",
            violation_number: String(violationNum),
            issued_date: issueDate.split("T")[0],
            hearing_date: null,
            cure_due_date: v.certifieddate ? (v.certifieddate as string).split("T")[0] : null,
            description_raw: hpdDescRaw,
            property_id,
            severity: hpdClass,
            violation_class: hpdClass,
            violation_type: extractViolationType(hpdDescRaw, hpdClass, "HPD"),
            is_stop_work_order: false,
            is_vacate_order: String(v.novdescription || "").toLowerCase().includes("vacate"),
            penalty_amount: null,
            respondent_name: null,
            synced_at: now,
            source: "hpd",
            oath_status: hpdStatus || null,
            status: isResolved ? 'closed' : 'open',
          });
        }
      }
    }

    // Fetch violations from OATH for agencies that use it
    const oathAgencies: AgencyType[] = ["FDNY", "DEP", "DOT", "DSNY", "LPC", "DOF"];
    for (const agency of oathAgencies) {
      if (agenciesToSync.includes(agency)) {
        await fetchOATHViolations(agency);
      }
    }

    // Deduplicate by composite key: agency + violation_number
    // Different agencies can have overlapping violation numbers
    const uniqueViolations = Array.from(
      new Map(violations.map((v) => [`${v.agency}:${v.violation_number}`, v])).values()
    );

    console.log(`Total unique violations: ${uniqueViolations.length}`);

    let newViolationsCount = 0;
    let criticalCount = 0;
    let propertyAddress = "";
    let ownerPhone = "";

    // Get property info for SMS
    if (property_id) {
      const { data: propertyData } = await supabase
        .from("properties")
        .select("address, owner_phone, sms_enabled")
        .eq("id", property_id)
        .single();

      if (propertyData) {
        propertyAddress = propertyData.address || "";
        ownerPhone = propertyData.owner_phone || "";
      }
    }

    // Insert new violations + refresh status for existing ones
    if (uniqueViolations.length > 0 && property_id) {
      // We refresh existing records every sync so OATH "Written Off" (etc.) actually updates counters.
      const { data: existingViolations, error: existingError } = await supabase
        .from("violations")
        .select("id, violation_number, agency")
        .eq("property_id", property_id);

      if (existingError) {
        console.error("Error fetching existing violations:", existingError);
      }

      // Use composite key for matching existing violations
      const existingMap = new Map(
        (existingViolations || []).map((v) => [`${v.agency}:${v.violation_number}`, v.id] as const)
      );

       const newViolations = uniqueViolations.filter(
         (v) => !existingMap.has(`${v.agency}:${v.violation_number}`)
       );

       const existingToUpdate = uniqueViolations.filter((v) =>
         existingMap.has(`${v.agency}:${v.violation_number}`)
       );

       console.log(
         `Existing violations in DB: ${existingMap.size}. New: ${newViolations.length}. Refreshing existing: ${existingToUpdate.length}.`
       );

      newViolationsCount = newViolations.length;
      criticalCount = uniqueViolations.filter(
        (v) => v.is_stop_work_order || v.is_vacate_order || v.severity === "critical"
      ).length;

      // Insert new
      if (newViolations.length > 0) {
        // Remove source field before insert as it's not in the DB schema
        const violationsToInsert = newViolations.map(({ source, ...rest }) => rest);

        const { error: insertError } = await supabase
          .from("violations")
          .insert(violationsToInsert);

        if (insertError) {
          console.error("Error inserting violations:", insertError);
        } else {
          console.log(`Inserted ${newViolations.length} new violations`);
        }
      }

      // Update existing (status + oath_status + synced_at, etc.)
      if (existingToUpdate.length > 0) {
        const updateResults = await Promise.all(
          existingToUpdate.map(async ({ source, ...v }) => {
            const id = existingMap.get(`${v.agency}:${v.violation_number}`);
            if (!id) return { ok: true };

            const { error } = await supabase
              .from("violations")
              .update({
                agency: v.agency,
                issued_date: v.issued_date,
                hearing_date: v.hearing_date,
                cure_due_date: v.cure_due_date,
                description_raw: v.description_raw,
                severity: v.severity,
                violation_class: v.violation_class,
                violation_type: v.violation_type,
                is_stop_work_order: v.is_stop_work_order,
                is_vacate_order: v.is_vacate_order,
                penalty_amount: v.penalty_amount,
                respondent_name: v.respondent_name,
                synced_at: v.synced_at,
                oath_status: v.oath_status ?? null,
                status: v.status,
              })
              .eq("id", id);

            if (error) {
              console.error(
                `Error updating violation ${v.violation_number} (${v.agency}):`,
                error
              );
              return { ok: false };
            }

            return { ok: true };
          })
        );

        const failed = updateResults.filter((r) => !r.ok).length;
        console.log(
          `Updated ${existingToUpdate.length - failed}/${existingToUpdate.length} existing violations with latest OATH/status data`
        );
      }

      // Update property last_synced_at
      await supabase
        .from("properties")
        .update({ last_synced_at: now })
        .eq("id", property_id);

      // Log activity
      const activityDescription = newViolationsCount > 0
        ? `Found ${newViolationsCount} new violation${newViolationsCount > 1 ? 's' : ''} from NYC Open Data`
        : 'No new violations found';

      await supabase.from("property_activity_log").insert({
        property_id,
        activity_type: "sync",
        title: `Violation Sync Completed`,
        description: activityDescription,
        metadata: {
          agencies_synced: agenciesToSync.join(", "),
          total_found: uniqueViolations.length,
          new_violations: newViolationsCount,
          critical_count: criticalCount,
        },
      });

      // Log individual new violations (first 5)
      if (newViolationsCount > 0) {
        const violationLogs = newViolations.slice(0, 5).map(v => ({
          property_id,
          activity_type: "violation_added",
          title: `New ${v.agency} Violation`,
          description: v.description_raw?.substring(0, 200) || `Violation #${v.violation_number}`,
          metadata: {
            violation_number: v.violation_number,
            agency: v.agency,
            issued_date: v.issued_date,
          },
        }));

        await supabase.from("property_activity_log").insert(violationLogs);
      }

      // Send SMS alert if enabled and new violations found
      if (send_sms_alert !== false && newViolationsCount > 0 && ownerPhone) {
        let smsMessage = `🚨 ${newViolationsCount} new violation${newViolationsCount > 1 ? 's' : ''} found at ${propertyAddress}`;

        if (criticalCount > 0) {
          smsMessage += ` ⚠️ ${criticalCount} CRITICAL`;
        }

        smsMessage += `. Agencies: ${agenciesToSync.join(", ")}. Log in to review.`;

        await sendSMSAlert(supabaseUrl, supabaseServiceKey, ownerPhone, smsMessage);

        // Log SMS sent
        await supabase.from("property_activity_log").insert({
          property_id,
          activity_type: "sms_sent",
          title: "SMS Alert Sent",
          description: `Notified owner about ${newViolationsCount} new violations`,
          metadata: { to: ownerPhone.slice(-4) },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_found: uniqueViolations.length,
        new_violations: newViolationsCount,
        critical_count: criticalCount,
        agencies_synced: agenciesToSync,
        sms_sent: newViolationsCount > 0 && ownerPhone ? true : false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching NYC violations:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
