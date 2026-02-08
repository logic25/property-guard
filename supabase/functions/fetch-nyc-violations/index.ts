import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// NYC Open Data API endpoints (Socrata) - No API key needed, 1000 req/hr limit
const NYC_OPEN_DATA_ENDPOINTS = {
  DOB: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json", // DOB Violations
  ECB: "https://data.cityofnewyork.us/resource/6bgk-3dad.json", // ECB Violations
};

interface DOBViolation {
  violation_number?: string;
  bin?: string;
  boro?: string;
  block?: string;
  lot?: string;
  issue_date?: string;
  violation_type?: string;
  violation_category?: string;
  description?: string;
  house_number?: string;
  street_name?: string;
}

interface ECBViolation {
  ecb_violation_number?: string;
  bin?: string;
  boro?: string;
  block?: string;
  lot?: string;
  issue_date?: string;
  violation_type?: string;
  severity?: string;
  violation_description?: string;
  scheduled_hearing_date?: string;
  house_number?: string;
  street?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const { address, bin, property_id } = await req.json();

    if (!address && !bin) {
      throw new Error("Either address or BIN is required");
    }

    console.log(`Fetching violations for: ${address || bin}`);

    const violations: Array<{
      agency: "DOB" | "ECB";
      violation_number: string;
      issued_date: string;
      hearing_date: string | null;
      description_raw: string | null;
      property_id: string;
    }> = [];

    // Fetch DOB Violations
    if (bin) {
      const dobUrl = `${NYC_OPEN_DATA_ENDPOINTS.DOB}?bin=${bin}&$limit=50&$order=issue_date DESC`;
      console.log(`Fetching DOB violations: ${dobUrl}`);
      
      const dobResponse = await fetch(dobUrl);
      if (dobResponse.ok) {
        const dobData: DOBViolation[] = await dobResponse.json();
        console.log(`Found ${dobData.length} DOB violations`);
        
        for (const v of dobData) {
          if (v.violation_number && v.issue_date) {
            violations.push({
              agency: "DOB",
              violation_number: v.violation_number,
              issued_date: v.issue_date.split("T")[0],
              hearing_date: null,
              description_raw: v.description || v.violation_category || null,
              property_id,
            });
          }
        }
      } else {
        console.error(`DOB API error: ${dobResponse.status}`);
      }

      // Fetch ECB Violations
      const ecbUrl = `${NYC_OPEN_DATA_ENDPOINTS.ECB}?bin=${bin}&$limit=50&$order=issue_date DESC`;
      console.log(`Fetching ECB violations: ${ecbUrl}`);
      
      const ecbResponse = await fetch(ecbUrl);
      if (ecbResponse.ok) {
        const ecbData: ECBViolation[] = await ecbResponse.json();
        console.log(`Found ${ecbData.length} ECB violations`);
        
        for (const v of ecbData) {
          if (v.ecb_violation_number && v.issue_date) {
            violations.push({
              agency: "ECB",
              violation_number: v.ecb_violation_number,
              issued_date: v.issue_date.split("T")[0],
              hearing_date: v.scheduled_hearing_date?.split("T")[0] || null,
              description_raw: v.violation_description || null,
              property_id,
            });
          }
        }
      } else {
        console.error(`ECB API error: ${ecbResponse.status}`);
      }
    }

    // Insert new violations (upsert to avoid duplicates)
    if (violations.length > 0 && property_id) {
      const { data: existingViolations } = await supabase
        .from("violations")
        .select("violation_number")
        .eq("property_id", property_id);

      const existingNumbers = new Set(
        existingViolations?.map((v) => v.violation_number) || []
      );

      const newViolations = violations.filter(
        (v) => !existingNumbers.has(v.violation_number)
      );

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
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_found: violations.length,
        violations,
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
