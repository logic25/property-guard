import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    let scheduleType = "nightly";
    try {
      const body = await req.json();
      scheduleType = body.schedule_type || "nightly";
    } catch { /* empty */ }

    console.log(`Running scheduled sync: ${scheduleType}`);

    // Get all NYC properties with BIN
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, bin, applicable_agencies, address, sms_enabled, owner_phone, user_id")
      .eq("jurisdiction", "NYC")
      .not("bin", "is", null);

    if (propError) throw propError;

    console.log(`Found ${properties?.length || 0} NYC properties to sync`);

    const results = {
      total_properties: properties?.length || 0,
      synced: 0,
      errors: 0,
      new_violations: 0,
      changes_detected: 0,
      schedule_type: scheduleType,
    };

    const agenciesToSync = scheduleType === "dob_quick" ? ["DOB"] : undefined;

    for (const property of properties || []) {
      try {
        console.log(`Syncing property: ${property.address} (BIN: ${property.bin})`);

        // --- Snapshot existing violations & applications BEFORE sync ---
        const [existingViolations, existingApplications] = await Promise.all([
          supabase.from("violations").select("id, violation_number, status, description_raw, agency").eq("property_id", property.id),
          supabase.from("applications").select("id, application_number, status, application_type, agency, source").eq("property_id", property.id),
        ]);

        const violationsBefore = new Map((existingViolations.data || []).map((v: any) => [v.violation_number, v]));
        const appsBefore = new Map((existingApplications.data || []).map((a: any) => [a.application_number, a]));

        // --- Run sync ---
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

          // --- Detect changes AFTER sync ---
          const [afterViolations, afterApplications] = await Promise.all([
            supabase.from("violations").select("id, violation_number, status, description_raw, agency").eq("property_id", property.id),
            supabase.from("applications").select("id, application_number, status, application_type, agency, source").eq("property_id", property.id),
          ]);

          const changes: any[] = [];

          // Check for new/changed violations
          for (const v of (afterViolations.data || [])) {
            const before = violationsBefore.get(v.violation_number);
            if (!before) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "violation",
                entity_id: v.id,
                change_type: "new",
                new_value: v.status,
                entity_label: v.violation_number,
                description: `New ${v.agency} violation ${v.violation_number}: ${(v.description_raw || "").substring(0, 100)}`,
              });
            } else if (before.status !== v.status) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "violation",
                entity_id: v.id,
                change_type: "status_change",
                previous_value: before.status,
                new_value: v.status,
                entity_label: v.violation_number,
                description: `${v.agency} violation ${v.violation_number} status changed: ${before.status} → ${v.status}`,
              });
            }
          }

          // Check for new/changed applications
          for (const a of (afterApplications.data || [])) {
            const before = appsBefore.get(a.application_number);
            if (!before) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "application",
                entity_id: a.id,
                change_type: "new",
                new_value: a.status,
                entity_label: a.application_number,
                description: `New ${a.agency} application ${a.application_number}: ${a.application_type}`,
              });
            } else if (before.status !== a.status) {
              changes.push({
                user_id: property.user_id,
                property_id: property.id,
                entity_type: "application",
                entity_id: a.id,
                change_type: "status_change",
                previous_value: before.status,
                new_value: a.status,
                entity_label: a.application_number,
                description: `${a.agency} application ${a.application_number} status: ${before.status} → ${a.status}`,
              });
            }
          }

          // Insert changes
          if (changes.length > 0) {
            const { error: changeError } = await supabase.from("change_log").insert(changes);
            if (changeError) console.error("Error logging changes:", changeError);
            else results.changes_detected += changes.length;
            console.log(`  -> ${changes.length} changes detected`);
          }

          console.log(`  -> Found ${result.new_violations} new violations`);
        } else {
          results.errors++;
          console.error(`  -> Sync failed: ${response.status}`);
        }

        // --- Apply age-based suppression ---
        try {
          const { data: openViolations } = await supabase
            .from("violations")
            .select("id, agency, issued_date, status, suppressed")
            .eq("property_id", property.id)
            .eq("status", "open")
            .eq("suppressed", false);

          if (openViolations && openViolations.length > 0) {
            const AGING_RULES: Record<string, number> = { ECB: 730, DOB: 1095, HPD: 1095 };
            let suppressedCount = 0;

            for (const v of openViolations) {
              const rule = AGING_RULES[v.agency];
              if (!rule) continue;
              const daysSince = Math.floor((Date.now() - new Date(v.issued_date).getTime()) / (1000 * 60 * 60 * 24));
              if (daysSince > rule) {
                const years = Math.floor(daysSince / 365);
                await supabase.from("violations").update({
                  suppressed: true,
                  suppression_reason: `${v.agency} violation open >${Math.floor(rule / 365)} years likely resolved but not updated (${years} year${years !== 1 ? 's' : ''} old)`,
                }).eq("id", v.id);
                suppressedCount++;
              }
            }
            if (suppressedCount > 0) console.log(`  -> Suppressed ${suppressedCount} stale violations`);
          }
        } catch (suppressErr) {
          console.error("Suppression error:", suppressErr);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.errors++;
        console.error(`Error syncing property ${property.id}:`, error);
      }
    }

    // --- If nightly sync, trigger daily summary emails (disabled during testing) ---
    if (false && scheduleType === "nightly" && results.changes_detected > 0) {
      try {
        console.log("Triggering daily change summary emails...");
        const summaryRes = await fetch(`${supabaseUrl}/functions/v1/send-change-summary`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({}),
        });
        if (summaryRes.ok) {
          const summaryResult = await summaryRes.json();
          console.log("Change summary emails sent:", summaryResult);
        } else {
          console.error("Failed to send change summaries:", summaryRes.status);
        }
      } catch (e) {
        console.error("Error sending change summaries:", e);
      }
    }

    // Generate deadline reminder notifications (7/3/1 days before)
    try {
      const { error: reminderError } = await supabase.rpc('generate_deadline_reminders');
      if (reminderError) {
        console.error("Error generating deadline reminders:", reminderError);
      } else {
        console.log("Deadline reminders generated successfully");
      }
    } catch (e) {
      console.error("Error calling generate_deadline_reminders:", e);
    }

    console.log(`Scheduled sync complete: ${results.synced} synced, ${results.errors} errors, ${results.new_violations} new violations, ${results.changes_detected} changes detected`);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduled sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
