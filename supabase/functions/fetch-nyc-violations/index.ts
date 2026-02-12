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
  // DOB Complaints
  DOB_COMPLAINTS: "https://data.cityofnewyork.us/resource/eabe-havv.json",
  // Additional agency datasets
  DEP: "https://data.cityofnewyork.us/resource/xbs2-bdct.json",
  DOT: "https://data.cityofnewyork.us/resource/w286-9scw.json",
  DSNY: "https://data.cityofnewyork.us/resource/erm2-nwe9.json",
  LPC: "https://data.cityofnewyork.us/resource/wyev-xvpj.json",
  DOF: "https://data.cityofnewyork.us/resource/bnx9-e6tj.json",
  CO: "https://data.cityofnewyork.us/resource/bs8b-p36w.json",
  // Application endpoints
  DOB_BIS_JOBS: "https://data.cityofnewyork.us/resource/ic3t-wcy2.json",
  DOB_NOW_BUILD: "https://data.cityofnewyork.us/resource/w9ak-ipjd.json",
  DOB_NOW_LIMITED_ALT: "https://data.cityofnewyork.us/resource/xxbr-ypig.json",
  DOB_NOW_ELECTRICAL: "https://data.cityofnewyork.us/resource/dm9a-ab7w.json",
  DOB_NOW_ELEVATOR: "https://data.cityofnewyork.us/resource/kfp4-dz4h.json",
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

// DOB violation code prefixes and their meanings
const DOB_CODE_PREFIXES: Record<string, { type: string; description: string }> = {
  'FTC-VT-PER': { type: 'elevator', description: 'Failure to Correct - Elevator Periodic Test' },
  'FTC-VT-CAT1': { type: 'elevator', description: 'Failure to Correct - Elevator Category 1 Test' },
  'FTC-VT-CAT5': { type: 'elevator', description: 'Failure to Correct - Elevator Category 5 Test' },
  'FTF-VT-PER': { type: 'elevator', description: 'Failure to File - Elevator Periodic Test' },
  'FTF-VT-CAT1': { type: 'elevator', description: 'Failure to File - Elevator Category 1 Test' },
  'FTF-VT-CAT5': { type: 'elevator', description: 'Failure to File - Elevator Category 5 Test' },
  'FTC-EN-BENCH': { type: 'elevator', description: 'Failure to Correct - Elevator Benchmarking' },
  'FTF-EN-BENCH': { type: 'elevator', description: 'Failure to File - Elevator Benchmarking' },
  'FTC-AEU-HAZ': { type: 'elevator', description: 'Failure to Correct - Elevator Hazardous Condition' },
  'FTF-AEU-HAZ': { type: 'elevator', description: 'Failure to File - Elevator Hazardous Condition' },
  'FTF-PL-PER': { type: 'gas_piping', description: 'Failure to File - Gas Piping Periodic Inspection (Local Law 152)' },
  'FTC-PL-PER': { type: 'gas_piping', description: 'Failure to Correct - Gas Piping Periodic Inspection (Local Law 152)' },
  'FTF-PL': { type: 'plumbing', description: 'Failure to File - Plumbing Compliance' },
  'FTC-PL': { type: 'plumbing', description: 'Failure to Correct - Plumbing Compliance' },
  'FTF-BL-PER': { type: 'hvac', description: 'Failure to File - Boiler Periodic Inspection' },
  'FTC-BL-PER': { type: 'hvac', description: 'Failure to Correct - Boiler Periodic Inspection' },
  'FTF-SP-PER': { type: 'fire_safety', description: 'Failure to File - Sprinkler Periodic Inspection' },
  'FTC-SP-PER': { type: 'fire_safety', description: 'Failure to Correct - Sprinkler Periodic Inspection' },
  'FTF-FA-PER': { type: 'structural', description: 'Failure to File - Façade Periodic Inspection (LL11/FISP)' },
  'FTC-FA-PER': { type: 'structural', description: 'Failure to Correct - Façade Periodic Inspection (LL11/FISP)' },
  'FTF-RE-PER': { type: 'structural', description: 'Failure to File - Retaining Wall Periodic Inspection' },
  'FTC-RE-PER': { type: 'structural', description: 'Failure to Correct - Retaining Wall Periodic Inspection' },
};

// Decode a DOB violation code into a human-readable description
function decodeDOBViolationCode(code: string | null): { type: string; description: string } | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  
  // Try exact prefix matches (longest first)
  const sortedPrefixes = Object.keys(DOB_CODE_PREFIXES).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (upper.includes(prefix)) {
      return DOB_CODE_PREFIXES[prefix];
    }
  }
  
  // Generic FTF/FTC patterns
  if (upper.includes('FTF')) return { type: 'compliance', description: 'Failure to File - Compliance Document' };
  if (upper.includes('FTC')) return { type: 'compliance', description: 'Failure to Correct - Compliance Issue' };
  if (upper.includes('NOD')) return { type: 'compliance', description: 'Notice of Deficiency' };
  
  return null;
}

// Extract violation type from description or category
function extractViolationType(description: string | null, category: string | null, agency: string): string | null {
  const text = `${description || ''} ${category || ''}`.toLowerCase();
  
  // First try DOB code decoding for precise classification
  const decoded = decodeDOBViolationCode(description);
  if (decoded) return decoded.type;
  
  // Elevator-related (specific terms only, not generic FTF/FTC)
  if (text.includes('elevator') || text.includes('escalator') || text.includes('convey') || 
      text.includes('lift') || text.includes('dumbwaiter')) {
    return 'elevator';
  }
  // Gas piping / LL152
  if (text.includes('gas piping') || text.includes('ll152') || text.includes('local law 152') ||
      text.includes('gas leak') || text.includes('gas line')) {
    return 'gas_piping';
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

    // Fetch DOB Complaints
    if (agenciesToSync.includes("DOB") && bin) {
      const complaintsData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.DOB_COMPLAINTS}?bin=${bin}&$limit=100&$order=date_entered DESC`,
        "DOB_COMPLAINTS"
      );

      console.log(`Found ${complaintsData.length} DOB complaints`);

      for (const v of complaintsData as Record<string, unknown>[]) {
        const complaintNum = v.complaint_number as string;
        const dateEntered = v.date_entered as string;

        if (complaintNum && dateEntered) {
          const dispositionCode = (v.disposition_code || "") as string;
          const dispositionDate = v.disposition_date as string || null;
          const isResolved = dispositionCode === "I2" || dispositionCode === "C1" ||
                            dispositionCode === "A1" || dispositionDate !== null;

          const category = (v.complaint_category || "") as string;
          const status_desc = (v.status || "") as string;
          const descRaw = [
            category,
            v.unit ? `Unit: ${v.unit}` : null,
            v.special_condition ? `Special: ${v.special_condition}` : null,
            v.comments ? `${v.comments}` : null,
          ].filter(Boolean).join(" — ");

          violations.push({
            agency: "DOB",
            violation_number: `COMP-${complaintNum}`,
            issued_date: dateEntered.split("T")[0],
            hearing_date: null,
            cure_due_date: null,
            description_raw: descRaw || `DOB Complaint #${complaintNum}`,
            property_id,
            severity: (v.priority as string) === "A" ? "critical" :
                      (v.priority as string) === "B" ? "medium" : "low",
            violation_class: category,
            violation_type: extractViolationType(descRaw, category, "DOB"),
            is_stop_work_order: false,
            is_vacate_order: false,
            penalty_amount: null,
            respondent_name: null,
            synced_at: now,
            source: "dob_complaints",
            oath_status: status_desc || null,
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

    // ===== APPLICATIONS SYNC =====
    const applicationRecords: Array<{
      property_id: string;
      application_number: string;
      application_type: string;
      agency: string;
      source: string;
      status: string | null;
      filing_date: string | null;
      approval_date: string | null;
      expiration_date: string | null;
      job_type: string | null;
      work_type: string | null;
      description: string | null;
      applicant_name: string | null;
      owner_name: string | null;
      estimated_cost: number | null;
      stories: number | null;
      dwelling_units: number | null;
      floor_area: number | null;
      raw_data?: Record<string, unknown> | null;
    }> = [];

    // Fetch DOB BIS Job Application Filings
    if (bin) {
      const [bisJobs, dobNowBuild, dobNowLimitedAlt, dobNowElectrical, dobNowElevator] = await Promise.all([
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_BIS_JOBS}?bin__=${bin}&$limit=200&$order=latest_action_date DESC`, "DOB_BIS_JOBS"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_BUILD}?bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_BUILD"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_LIMITED_ALT}?location_bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_LIMITED_ALT"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_ELECTRICAL}?bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_ELECTRICAL"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NOW_ELEVATOR}?bin=${bin}&$limit=200&$order=filing_date DESC`, "DOB_NOW_ELEVATOR"),
      ]);

      console.log(`Found ${bisJobs.length} BIS jobs, ${dobNowBuild.length} Build, ${dobNowLimitedAlt.length} Limited Alt, ${dobNowElectrical.length} Electrical, ${dobNowElevator.length} Elevator apps`);

      for (const j of bisJobs as Record<string, unknown>[]) {
        const jobNum = j.job__ as string;
        if (!jobNum) continue;

        const jobType = (j.job_type as string) || null;
        const jobTypeLabel = jobType === 'NB' ? 'New Building' :
                            jobType === 'A1' ? 'Alteration Type 1' :
                            jobType === 'A2' ? 'Alteration Type 2' :
                            jobType === 'A3' ? 'Alteration Type 3' :
                            jobType === 'DM' ? 'Demolition' :
                            jobType === 'SG' ? 'Sign' :
                            jobType || 'Job Filing';

        applicationRecords.push({
          property_id,
          application_number: String(jobNum),
          application_type: jobTypeLabel,
          agency: 'DOB',
          source: 'DOB BIS',
          status: (j.job_status as string) || (j.latest_action_date ? 'Filed' : null),
          filing_date: j.pre__filing_date ? (j.pre__filing_date as string).split('T')[0] :
                       j.latest_action_date ? (j.latest_action_date as string).split('T')[0] : null,
          approval_date: j.approved_date ? (j.approved_date as string).split('T')[0] :
                         j.fully_permitted_date ? (j.fully_permitted_date as string).split('T')[0] : null,
          expiration_date: j.job_status_descrp?.toString().toLowerCase().includes('expired') ? 
                          (j.latest_action_date as string)?.split('T')[0] || null : null,
          job_type: jobType,
          work_type: (j.building_type as string) || null,
          description: [
            j.job_description,
            j.building_type ? `Building Type: ${j.building_type}` : null,
          ].filter(Boolean).join(' — ') || null,
          applicant_name: (j.applicant_s_first_name && j.applicant_s_last_name)
            ? `${j.applicant_s_first_name} ${j.applicant_s_last_name}`.trim()
            : null,
          owner_name: (j.owner_s_first_name && j.owner_s_last_name)
            ? `${j.owner_s_first_name} ${j.owner_s_last_name}`.trim()
            : (j.owner_s_business_name as string) || null,
          estimated_cost: j.initial_cost ? parseFloat(j.initial_cost as string) : null,
          stories: j.proposed_no_of_stories ? parseInt(j.proposed_no_of_stories as string) : null,
          dwelling_units: j.proposed_dwelling_units ? parseInt(j.proposed_dwelling_units as string) : null,
          floor_area: j.proposed_zoning_sqft ? parseFloat(j.proposed_zoning_sqft as string) : null,
        });
      }

      for (const a of dobNowBuild as Record<string, unknown>[]) {
        const appNum = (a.job_filing_number || a.dobrunjobnumber) as string;
        if (!appNum) continue;

        const jobType = (a.job_type as string) || null;
        const workOnFloor = (a.work_on_floor as string) || null;
        const aptCondo = (a.apt_condo_no_s as string) || null;

        const descParts = [
          workOnFloor,
          a.building_type ? `Building Type: ${a.building_type}` : null,
        ].filter(Boolean);

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: jobType || 'DOB NOW Filing',
          agency: 'DOB',
          source: 'DOB NOW Build',
          status: (a.filing_status as string) || (a.current_status_date ? 'Filed' : null),
          filing_date: a.filing_date ? (a.filing_date as string).split('T')[0] : null,
          approval_date: a.approved_date ? (a.approved_date as string).split('T')[0] : null,
          expiration_date: a.expiration_date ? (a.expiration_date as string).split('T')[0] : null,
          job_type: jobType,
          work_type: (a.building_type as string) || null,
          description: descParts.join(' — ') || null,
          applicant_name: (a.applicant_first_name && a.applicant_last_name)
            ? `${a.applicant_first_name} ${a.applicant_last_name}`.trim()
            : null,
          owner_name: (a.owner_s_business_name as string) || 
            ((a.owner_first_name && a.owner_last_name)
              ? `${a.owner_first_name} ${a.owner_last_name}`.trim()
              : null),
          estimated_cost: a.initial_cost ? parseFloat(a.initial_cost as string) : null,
          stories: a.proposed_no_of_stories ? parseInt(a.proposed_no_of_stories as string) : null,
          dwelling_units: a.proposed_dwelling_units ? parseInt(a.proposed_dwelling_units as string) : null,
          floor_area: a.total_construction_floor_area ? parseFloat(a.total_construction_floor_area as string) : null,
          raw_data: {
            apt_condo: aptCondo,
            applicant_license: a.applicant_license || null,
            applicant_title: a.applicant_professional_title || null,
            applicant_business_name: a.applicant_business_name || null,
            applicant_phone: a.applicant_phone || null,
            applicant_email: a.applicant_email || null,
            filing_rep_name: (a.filing_representative_first_name && a.filing_representative_last_name)
              ? `${a.filing_representative_first_name} ${a.filing_representative_last_name}`.trim()
              : null,
            filing_rep_company: a.filing_representative_business_name || null,
            work_on_floor: workOnFloor,
            first_permit_date: a.first_permit_date ? (a.first_permit_date as string).split('T')[0] : null,
            special_inspection: a.specialinspectionrequirement || null,
            special_inspection_agency: a.special_inspection_agency_number || null,
            progress_inspection: a.progressinspectionrequirement || null,
            progress_inspection_agency: a.progress_inspection_agency_number || null,
            review_building_code: a.review_building_code || null,
            plumbing_work: a.plumbing_work_type === '1',
            sprinkler_work: a.sprinkler_work_type === '1',
            existing_stories: a.existing_stories || null,
            existing_height: a.existing_height || null,
            proposed_stories: a.proposed_no_of_stories || null,
            proposed_height: a.proposed_height || null,
          },
        });
      }

      // DOB NOW: Build – Limited Alteration Applications (plumbing, fire suppression, oil work, etc.)
      for (const la of dobNowLimitedAlt as Record<string, unknown>[]) {
        const appNum = (la.permit_number || la.job_number) as string;
        if (!appNum) continue;

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: (la.work_type_name as string) || 'Limited Alteration',
          agency: 'DOB',
          source: 'DOB NOW Limited Alt',
          status: (la.filing_status_name as string) || null,
          filing_date: la.filing_date ? (la.filing_date as string).split('T')[0] : null,
          approval_date: la.permit_issued_date ? (la.permit_issued_date as string).split('T')[0] : null,
          expiration_date: la.permit_expiration_date ? (la.permit_expiration_date as string).split('T')[0] : null,
          job_type: (la.filing_type_name as string) || null,
          work_type: (la.work_type_name as string) || null,
          description: (la.proposed_work_summary as string) || null,
          applicant_name: null,
          owner_name: null,
          estimated_cost: null,
          stories: null,
          dwelling_units: null,
          floor_area: null,
          raw_data: {
            building_type: la.building_type_name || null,
            inspection_type: la.inspection_type_name || null,
            inspection_date: la.inspection_date ? (la.inspection_date as string).split('T')[0] : null,
            signoff_date: la.laasign_off_date ? (la.laasign_off_date as string).split('T')[0] : null,
          },
        });
      }

      // DOB NOW: Electrical Permit Applications
      for (const el of dobNowElectrical as Record<string, unknown>[]) {
        const appNum = (el.job_filing_number || el.job_number) as string;
        if (!appNum) continue;

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: 'Electrical Permit',
          agency: 'DOB',
          source: 'DOB NOW Electrical',
          status: (el.filing_status as string) || null,
          filing_date: el.filing_date ? (el.filing_date as string).split('T')[0] : null,
          approval_date: null,
          expiration_date: null,
          job_type: (el.filing_type as string) || null,
          work_type: 'Electrical',
          description: (el.job_description as string) || null,
          applicant_name: (el.applicant_first_name && el.applicant_last_name)
            ? `${el.applicant_first_name} ${el.applicant_last_name}`.trim()
            : null,
          owner_name: (el.owner_first_name && el.owner_last_name)
            ? `${el.owner_first_name} ${el.owner_last_name}`.trim()
            : null,
          estimated_cost: null,
          stories: null,
          dwelling_units: null,
          floor_area: null,
          raw_data: {
            license_type: el.license_type || null,
            license_number: el.license_number || null,
            firm_name: el.firm_name || null,
            firm_number: el.firm_number || null,
            building_use_type: el.building_use_type || null,
            general_wiring: el.general_wiring || null,
            lighting_work: el.lighting_work || null,
            hvac_wiring: el.hvac_wiring || null,
            total_meters: el.total_meters || null,
            job_start_date: el.job_start_date ? (el.job_start_date as string).split('T')[0] : null,
            completion_date: el.completion_date ? (el.completion_date as string).split('T')[0] : null,
          },
        });
      }

      // DOB NOW: Build – Elevator Permit Applications
      for (const ev of dobNowElevator as Record<string, unknown>[]) {
        const appNum = (ev.job_filing_number || ev.job_number) as string;
        if (!appNum) continue;

        applicationRecords.push({
          property_id,
          application_number: String(appNum),
          application_type: (ev.elevatordevicetype as string) || 'Elevator Permit',
          agency: 'DOB',
          source: 'DOB NOW Elevator',
          status: (ev.filing_status as string) || null,
          filing_date: ev.filing_date ? (ev.filing_date as string).split('T')[0] : null,
          approval_date: ev.permit_entire_date ? (ev.permit_entire_date as string).split('T')[0] : null,
          expiration_date: ev.permit_expiration_date ? (ev.permit_expiration_date as string).split('T')[0] : null,
          job_type: (ev.filing_type as string) || null,
          work_type: (ev.filingstatus_or_filingincludes as string) || 'Elevator',
          description: (ev.descriptionofwork as string) || null,
          applicant_name: (ev.applicant_firstname && ev.applicant_lastname)
            ? `${ev.applicant_firstname} ${ev.applicant_lastname}`.trim()
            : null,
          owner_name: (ev.owner_businessname as string) ||
            ((ev.owner_firstname && ev.owner_lastname)
              ? `${ev.owner_firstname} ${ev.owner_lastname}`.trim()
              : null),
          estimated_cost: ev.estimated_cost ? parseFloat(ev.estimated_cost as string) : null,
          stories: ev.buildingstories ? parseInt(ev.buildingstories as string) : null,
          dwelling_units: null,
          floor_area: ev.total_construction_floor ? parseFloat(ev.total_construction_floor as string) : null,
          raw_data: {
            device_type: ev.elevatordevicetype || null,
            building_code: ev.building_code || null,
            design_professional: ev.designprofessional || null,
            design_professional_license: ev.designprofessional_license || null,
            applicant_business: ev.applicant_businessname || null,
            applicant_license: ev.applicant_license_number || null,
            asbestos_compliance: ev.asbestosabatementcompliance || null,
          },
        });
      }
    }

    // Deduplicate applications by source + application_number
    const uniqueApps = Array.from(
      new Map(applicationRecords.map(a => [`${a.source}:${a.application_number}`, a])).values()
    );

    let newAppsCount = 0;
    if (uniqueApps.length > 0 && property_id) {
      const { data: existingApps } = await supabase
        .from('applications')
        .select('id, application_number, source')
        .eq('property_id', property_id);

      const existingAppKeys = new Set(
        (existingApps || []).map(a => `${a.source}:${a.application_number}`)
      );

      const newApps = uniqueApps.filter(a => !existingAppKeys.has(`${a.source}:${a.application_number}`));
      newAppsCount = newApps.length;

      console.log(`Applications: ${existingAppKeys.size} existing, ${newApps.length} new`);

      if (newApps.length > 0) {
        const { error: appInsertError } = await supabase
          .from('applications')
          .insert(newApps);

        if (appInsertError) {
          console.error('Error inserting applications:', appInsertError);
        } else {
          console.log(`Inserted ${newApps.length} new applications`);
        }
      }

      // Update existing applications with latest data
      const appsToUpdate = uniqueApps.filter(a => existingAppKeys.has(`${a.source}:${a.application_number}`));
      if (appsToUpdate.length > 0) {
        for (const app of appsToUpdate) {
          const existingApp = (existingApps || []).find(
            e => `${e.source}:${e.application_number}` === `${app.source}:${app.application_number}`
          );
          if (!existingApp) continue;

          const { error: updateError } = await supabase
            .from('applications')
            .update({
              status: app.status,
              approval_date: app.approval_date,
              expiration_date: app.expiration_date,
              description: app.description,
              applicant_name: app.applicant_name,
              owner_name: app.owner_name,
              estimated_cost: app.estimated_cost,
              raw_data: app.raw_data || null,
            })
            .eq('id', existingApp.id);

          if (updateError) {
            console.error(`Error updating application ${app.application_number}:`, updateError);
          }
        }
        console.log(`Updated ${appsToUpdate.length} existing applications`);
      }
    }

    // ===== CERTIFICATE OF OCCUPANCY SYNC =====
    let coFound = false;
    if (bin) {
      try {
        // Strategy 1: Check the DOB NOW CO dataset (post-2012)
        const coData = await safeFetch(
          `${NYC_OPEN_DATA_ENDPOINTS.CO}?bin=${bin}&$limit=10&$order=c_o_issue_date%20DESC`,
          "CO"
        );

        console.log(`Found ${coData.length} CO records in DOB NOW dataset for BIN ${bin}`);

        if (coData.length > 0) {
          const latest = coData[0] as Record<string, unknown>;
          const coType = (latest.issue_type || latest.job_type || '') as string;
          const issuanceDate = (latest.c_o_issue_date || '') as string;
          const jobNumber = (latest.job_number || '') as string;
          
          let coStatus = 'valid';
          if (coType.toLowerCase().includes('temporary') || coType.toLowerCase().includes('tco')) {
            const expDate = latest.expiration_dd || latest.expiration_date;
            if (expDate && new Date(expDate as string) < new Date()) {
              coStatus = 'expired_tco';
            } else {
              coStatus = 'temporary';
            }
          }

          const coMetadata = {
            source: 'DOB_NOW_CO',
            type: coType,
            issuance_date: issuanceDate ? (issuanceDate as string).split('T')[0] : null,
            job_number: jobNumber || null,
            total_records: coData.length,
            latest_raw: latest,
          };

          await supabase
            .from('properties')
            .update({ co_status: coStatus, co_data: coMetadata })
            .eq('id', property_id);

          coFound = true;
          console.log(`CO status updated from DOB NOW: ${coStatus} (type: ${coType})`);

          // Create document reference
          const { data: existingCODoc } = await supabase
            .from('property_documents')
            .select('id')
            .eq('property_id', property_id)
            .eq('document_type', 'certificate_of_occupancy')
            .limit(1);

          if (!existingCODoc || existingCODoc.length === 0) {
            const coDescription = `${coType || 'Certificate of Occupancy'} — Issued ${issuanceDate ? new Date(issuanceDate as string).toLocaleDateString() : 'N/A'}${jobNumber ? ` (Job #${jobNumber})` : ''}`;
            const dobNowUrl = `https://a810-dobnow.nyc.gov/Publish/#!/certificate/${jobNumber || bin}`;

            await supabase.from('property_documents').insert({
              property_id,
              document_name: `Certificate of Occupancy${coType ? ` (${coType})` : ''}`,
              document_type: 'certificate_of_occupancy',
              description: coDescription,
              file_url: dobNowUrl,
              file_type: 'link',
              metadata: coMetadata,
            });
            console.log(`CO document reference created (DOB NOW)`);
          }
        }

        // Strategy 2: If no CO in DOB NOW dataset, check BIS Jobs for CO status codes
        // BIS job_status: J = CO issued, H = completed, I = signed-off
        if (!coFound) {
          const bisJobs = await safeFetch(
            `${NYC_OPEN_DATA_ENDPOINTS.DOB_BIS_JOBS}?bin__=${bin}&$limit=50&$order=latest_action_date%20DESC`,
            "BIS_CO_CHECK"
          );

          const BIS_CO_STATUSES: Record<string, string> = {
            'h': 'completed',
            'i': 'signed off',
            'j': 'co issued',
            'k': 'final co',
          };

          const coJob = (bisJobs as Record<string, unknown>[]).find(j => {
            const status = ((j.job_status || '') as string).toLowerCase();
            return status in BIS_CO_STATUSES;
          });

          if (coJob) {
            const jobStatus = ((coJob.job_status || '') as string).toLowerCase();
            const statusLabel = BIS_CO_STATUSES[jobStatus] || 'co issued';
            const jobNumber = (coJob.job__ || '') as string;
            const jobType = (coJob.job_type || '') as string;
            const actionDate = (coJob.latest_action_date || '') as string;

            const coMetadata = {
              source: 'BIS_JOBS',
              type: `BIS ${statusLabel}`,
              job_number: jobNumber,
              job_type: jobType,
              job_status: jobStatus,
              status_label: statusLabel,
              action_date: actionDate,
            };

            await supabase
              .from('properties')
              .update({ co_status: 'valid', co_data: coMetadata })
              .eq('id', property_id);

            coFound = true;
            console.log(`CO status updated from BIS Jobs: valid (${statusLabel}, Job #${jobNumber})`);

            // Create document reference linking to BIS
            const { data: existingCODoc } = await supabase
              .from('property_documents')
              .select('id')
              .eq('property_id', property_id)
              .eq('document_type', 'certificate_of_occupancy')
              .limit(1);

            if (!existingCODoc || existingCODoc.length === 0) {
              const bisUrl = `http://a810-bisweb.nyc.gov/bisweb/COsByLocationServlet?allbin=${bin}`;
              const coDescription = `BIS Certificate of Occupancy — Job #${jobNumber} (${jobType}), Status: ${statusLabel}`;

              await supabase.from('property_documents').insert({
                property_id,
                document_name: `Certificate of Occupancy (BIS)`,
                document_type: 'certificate_of_occupancy',
                description: coDescription,
                file_url: bisUrl,
                file_type: 'link',
                metadata: coMetadata,
              });
              console.log(`CO document reference created (BIS)`);
            }
          }
        }

        // If still no CO found, set status based on year built
        if (!coFound) {
          const { data: propData } = await supabase
            .from('properties')
            .select('year_built, co_status')
            .eq('id', property_id)
            .single();

          if (propData && (!propData.co_status || propData.co_status === 'unknown' || propData.co_status === 'missing')) {
            const yearBuilt = propData.year_built;
            const newStatus = yearBuilt && yearBuilt < 1938 ? 'pre_1938' : 'missing';
            await supabase
              .from('properties')
              .update({ co_status: newStatus })
              .eq('id', property_id);
            console.log(`No CO found in any source, status set to: ${newStatus}`);
          }
        }
      } catch (coError) {
        console.error('Error fetching CO data:', coError);
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
        applications_found: uniqueApps.length,
        new_applications: newAppsCount,
        co_found: coFound,
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
