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
  FDNY: "https://data.cityofnewyork.us/resource/ktas-47y7.json",
  CO: "https://data.cityofnewyork.us/resource/bs8b-p36w.json",
};

interface ViolationRecord {
  agency: "DOB" | "ECB" | "FDNY";
  violation_number: string;
  issued_date: string;
  hearing_date: string | null;
  cure_due_date: string | null;
  description_raw: string | null;
  property_id: string;
  severity: string | null;
  violation_class: string | null;
  is_stop_work_order: boolean;
  is_vacate_order: boolean;
  penalty_amount: number | null;
  respondent_name: string | null;
  synced_at: string;
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

    const { bin, property_id, applicable_agencies } = await req.json();

    if (!bin) {
      throw new Error("BIN is required");
    }

    console.log(`Fetching violations for BIN: ${bin}, Agencies: ${(applicable_agencies || []).join(', ')}`);

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

    // Fetch DOB Violations (both old and new datasets)
    if (agenciesToSync.includes("DOB")) {
      const [dobOldData, dobNewData] = await Promise.all([
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_OLD}?bin=${bin}&$limit=100&$order=issue_date DESC`, "DOB_OLD"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NEW}?bin=${bin}&$limit=100&$order=issue_date DESC`, "DOB_NEW"),
      ]);

      console.log(`Found ${dobOldData.length} DOB (old) violations, ${dobNewData.length} DOB (new) violations`);

      for (const v of [...dobOldData, ...dobNewData] as Record<string, unknown>[]) {
        const violationNum = (v.violation_number || v.ecb_violation_number || v.number) as string;
        const issueDate = v.issue_date as string;
        
        if (violationNum && issueDate) {
          violations.push({
            agency: "DOB",
            violation_number: violationNum,
            issued_date: issueDate.split("T")[0],
            hearing_date: null,
            cure_due_date: null,
            description_raw: (v.description || v.violation_category || v.violation_type) as string || null,
            property_id,
            severity: (v.violation_type || v.severity) as string || null,
            violation_class: (v.violation_category || v.class) as string || null,
            is_stop_work_order: String(v.disposition_comments || "").toLowerCase().includes("stop work"),
            is_vacate_order: String(v.disposition_comments || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed as string) : null,
            respondent_name: (v.respondent_name || v.owner) as string || null,
            synced_at: now,
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
        
        if (violationNum && issueDate) {
          violations.push({
            agency: "ECB",
            violation_number: violationNum,
            issued_date: issueDate.split("T")[0],
            hearing_date: v.scheduled_hearing_date ? (v.scheduled_hearing_date as string).split("T")[0] : null,
            cure_due_date: null,
            description_raw: (v.violation_description || v.infraction_code1) as string || null,
            property_id,
            severity: (v.severity || v.aggravated_level) as string || null,
            violation_class: null,
            is_stop_work_order: false,
            is_vacate_order: false,
            penalty_amount: v.penality_imposed ? parseFloat(v.penality_imposed as string) : null,
            respondent_name: v.respondent_name as string || null,
            synced_at: now,
          });
        }
      }
    }

    // Fetch FDNY Violations
    if (agenciesToSync.includes("FDNY")) {
      const fdnyData = await safeFetch(
        `${NYC_OPEN_DATA_ENDPOINTS.FDNY}?bin=${bin}&$limit=100`,
        "FDNY"
      );

      console.log(`Found ${fdnyData.length} FDNY violations`);

      for (const v of fdnyData as Record<string, unknown>[]) {
        const violationNum = (v.violation_number || v.summons_number) as string;
        const issueDate = (v.issue_date || v.inspection_date) as string;
        
        if (violationNum && issueDate) {
          violations.push({
            agency: "FDNY",
            violation_number: String(violationNum),
            issued_date: issueDate.split("T")[0],
            hearing_date: null,
            cure_due_date: null,
            description_raw: (v.violation_type || v.description) as string || null,
            property_id,
            severity: "critical",
            violation_class: null,
            is_stop_work_order: false,
            is_vacate_order: String(v.violation_type || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penalty_amount ? parseFloat(v.penalty_amount as string) : null,
            respondent_name: null,
            synced_at: now,
          });
        }
      }
    }

    // Deduplicate by violation number
    const uniqueViolations = Array.from(
      new Map(violations.map((v) => [v.violation_number, v])).values()
    );

    console.log(`Total unique violations: ${uniqueViolations.length}`);

    let newViolationsCount = 0;

    // Insert new violations
    if (uniqueViolations.length > 0 && property_id) {
      const { data: existingViolations } = await supabase
        .from("violations")
        .select("violation_number")
        .eq("property_id", property_id);

      const existingNumbers = new Set(
        existingViolations?.map((v) => v.violation_number) || []
      );

      const newViolations = uniqueViolations.filter(
        (v) => !existingNumbers.has(v.violation_number)
      );

      newViolationsCount = newViolations.length;

      if (newViolations.length > 0) {
        const { error: insertError } = await supabase
          .from("violations")
          .insert(newViolations);

        if (insertError) {
          console.error("Error inserting violations:", insertError);
        } else {
          console.log(`Inserted ${newViolations.length} new violations`);
        }
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
        },
      });

      // Log individual new violations
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_found: uniqueViolations.length,
        new_violations: newViolationsCount,
        agencies_synced: agenciesToSync,
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
