import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Scheduled sync edge function - called by pg_cron
// Syncs violations for all properties based on schedule type
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

    // Parse schedule type from request body or default to 'nightly'
    let scheduleType = "nightly";
    try {
      const body = await req.json();
      scheduleType = body.schedule_type || "nightly";
    } catch {
      // No body provided, use default
    }

    console.log(`Running scheduled sync: ${scheduleType}`);

    // Get all NYC properties with BIN
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, bin, applicable_agencies, address, sms_enabled, owner_phone")
      .eq("jurisdiction", "NYC")
      .not("bin", "is", null);

    if (propError) {
      throw propError;
    }

    console.log(`Found ${properties?.length || 0} NYC properties to sync`);

    const results = {
      total_properties: properties?.length || 0,
      synced: 0,
      errors: 0,
      new_violations: 0,
      schedule_type: scheduleType,
    };

    // For DOB-only quick sync (every 4 hours during business), only sync DOB
    const agenciesToSync = scheduleType === "dob_quick" 
      ? ["DOB"] 
      : undefined; // undefined means use property's applicable_agencies

    // Sync each property
    for (const property of properties || []) {
      try {
        console.log(`Syncing property: ${property.address} (BIN: ${property.bin})`);

        const response = await fetch(`${supabaseUrl}/functions/v1/fetch-nyc-violations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            bin: property.bin,
            property_id: property.id,
            applicable_agencies: agenciesToSync || property.applicable_agencies,
            send_sms_alert: property.sms_enabled && property.owner_phone,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          results.synced++;
          results.new_violations += result.new_violations || 0;
          console.log(`  -> Found ${result.new_violations} new violations`);
        } else {
          results.errors++;
          console.error(`  -> Sync failed: ${response.status}`);
        }

        // Small delay between properties to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.errors++;
        console.error(`Error syncing property ${property.id}:`, error);
      }
    }

    console.log(`Scheduled sync complete: ${results.synced} synced, ${results.errors} errors, ${results.new_violations} new violations`);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Scheduled sync error:", error);
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
