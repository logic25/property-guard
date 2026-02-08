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
  // FDNY Violations via OATH Hearings - uses borough/block/lot
  FDNY: "https://data.cityofnewyork.us/resource/avgm-ztsb.json",
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

    // Parse BBL into components for FDNY lookup
    // BBL is 10 digits: 1 borough + 5 block + 4 lot
    let borough = "";
    let block = "";
    let lot = "";
    if (bbl && bbl.length >= 10) {
      borough = bbl.charAt(0);
      // Keep padded for FDNY OATH dataset which expects padded values
      block = bbl.substring(1, 6);  // Keep 5-digit block
      lot = bbl.substring(6, 10);   // Keep 4-digit lot
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

    // Fetch DOB Violations (both old and new datasets)
    if (agenciesToSync.includes("DOB")) {
      // DOB_OLD uses issue_date, DOB_NEW uses violation_issue_date
      const [dobOldData, dobNewData] = await Promise.all([
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_OLD}?bin=${bin}&$limit=100&$order=issue_date DESC`, "DOB_OLD"),
        safeFetch(`${NYC_OPEN_DATA_ENDPOINTS.DOB_NEW}?bin=${bin}&$limit=100&$order=violation_issue_date DESC`, "DOB_NEW"),
      ]);

      console.log(`Found ${dobOldData.length} DOB (old) violations, ${dobNewData.length} DOB (new) violations`);

      // Process OLD DOB violations
      for (const v of dobOldData as Record<string, unknown>[]) {
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
      
      // Process NEW DOB violations (DOB NOW system)
      for (const v of dobNewData as Record<string, unknown>[]) {
        const violationNum = v.violation_number as string;
        const issueDate = v.violation_issue_date as string;
        
        if (violationNum && issueDate) {
          violations.push({
            agency: "DOB",
            violation_number: violationNum,
            issued_date: issueDate.split("T")[0],
            hearing_date: null,
            cure_due_date: v.cure_date ? (v.cure_date as string).split("T")[0] : null,
            description_raw: (v.violation_description || v.violation_type) as string || null,
            property_id,
            severity: v.violation_type as string || null,
            violation_class: v.violation_category as string || null,
            is_stop_work_order: String(v.violation_description || "").toLowerCase().includes("stop work"),
            is_vacate_order: String(v.violation_description || "").toLowerCase().includes("vacate"),
            penalty_amount: v.penalty_amount ? parseFloat(v.penalty_amount as string) : null,
            respondent_name: v.respondent_name as string || null,
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

    // Fetch FDNY Violations via OATH Hearings - Uses borough/block/lot
    if (agenciesToSync.includes("FDNY") && borough && block && lot) {
      // FDNY OATH dataset uses borough name
      const boroughNames: Record<string, string> = {
        "1": "MANHATTAN",
        "2": "BRONX", 
        "3": "BROOKLYN",
        "4": "QUEENS",
        "5": "STATEN ISLAND",
      };
      const boroughName = boroughNames[borough] || "";

      if (boroughName) {
        // Query FDNY violations from OATH dataset using borough/block/lot
        const fdnyData = await safeFetch(
          `${NYC_OPEN_DATA_ENDPOINTS.FDNY}?violation_location_borough=${encodeURIComponent(boroughName)}&violation_location_block_no=${block}&violation_location_lot_no=${lot}&$limit=100&$order=violation_date DESC`,
          "FDNY"
        );

        console.log(`Found ${fdnyData.length} FDNY violations from OATH dataset`);

        for (const v of fdnyData as Record<string, unknown>[]) {
          const violationNum = v.ticket_number as string;
          const issueDate = v.violation_date as string;
          
          if (violationNum && issueDate) {
            // Get violation description from OATH data
            const description = [
              v.charge_1_code_description,
              v.charge_2_code_description,
              v.charge_3_code_description,
            ].filter(Boolean).join("; ") || "FDNY Violation";

            const hearingDate = v.hearing_date as string || v.scheduled_hearing_date as string;
            
            violations.push({
              agency: "FDNY",
              violation_number: String(violationNum),
              issued_date: issueDate.split("T")[0],
              hearing_date: hearingDate ? hearingDate.split("T")[0] : null,
              cure_due_date: null,
              description_raw: description,
              property_id,
              severity: "critical",
              violation_class: (v.charge_1_code || v.infraction_code) as string || null,
              is_stop_work_order: false,
              is_vacate_order: false,
              penalty_amount: v.penalty_imposed ? parseFloat(v.penalty_imposed as string) : 
                             v.total_violation_amount ? parseFloat(v.total_violation_amount as string) : null,
              respondent_name: v.respondent_first_name ? 
                `${v.respondent_first_name} ${v.respondent_last_name || ""}`.trim() : 
                v.respondent_name as string || null,
              synced_at: now,
            });
          }
        }
      } else {
        console.log("FDNY: Cannot query without valid borough from BBL");
      }
    } else if (agenciesToSync.includes("FDNY")) {
      console.log("FDNY: Skipped - requires BBL (Borough/Block/Lot) for lookup");
    }

    // Deduplicate by violation number
    const uniqueViolations = Array.from(
      new Map(violations.map((v) => [v.violation_number, v])).values()
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
      criticalCount = newViolations.filter(v => v.is_stop_work_order || v.is_vacate_order).length;

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
          smsMessage += ` ⚠️ ${criticalCount} CRITICAL (Stop Work/Vacate)`;
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
