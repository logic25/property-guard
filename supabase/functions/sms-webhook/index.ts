import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Twilio sends webhooks as application/x-www-form-urlencoded
async function parseFormData(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("SMS Webhook received");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      throw new Error("Twilio configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio webhook payload (form-encoded)
    const formData = await parseFormData(req);
    const from = formData.From; // Sender's phone number
    const to = formData.To; // Your Twilio number
    const body = formData.Body; // Message content
    const messageSid = formData.MessageSid;

    console.log(`Inbound SMS from ${from} to ${to}: ${body}`);

    if (!from || !body) {
      // Return TwiML empty response for invalid requests
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { "Content-Type": "application/xml" },
        }
      );
    }

    // Find property by assigned phone number OR the Twilio number
    // First try to find a property with this specific assigned number
    let property = null;
    const { data: propertyByAssigned } = await supabase
      .from("properties")
      .select("id, address, bin, bbl, borough, stories, dwelling_units, zoning_district, year_built, owner_name, applicable_agencies")
      .eq("assigned_phone_number", to)
      .maybeSingle();

    if (propertyByAssigned) {
      property = propertyByAssigned;
    } else {
      // If no property has this assigned number, pick the first SMS-enabled property
      // (In a multi-property system, you'd want a smarter routing mechanism)
      const { data: anyProperty } = await supabase
        .from("properties")
        .select("id, address, bin, bbl, borough, stories, dwelling_units, zoning_district, year_built, owner_name, applicable_agencies")
        .eq("sms_enabled", true)
        .limit(1)
        .maybeSingle();
      property = anyProperty;
    }

    if (!property) {
      console.log("No property found for this phone number");
      // Return TwiML with a helpful message
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, this number is not configured for any property. Please contact your property manager.</Message>
</Response>`;
      return new Response(twimlResponse, {
        headers: { "Content-Type": "application/xml" },
      });
    }

    console.log(`Found property: ${property.address} (${property.id})`);

    // Get violations for context
    const { data: violations } = await supabase
      .from("violations")
      .select("agency, violation_number, status, issued_date, description_raw, cure_due_date")
      .eq("property_id", property.id)
      .order("issued_date", { ascending: false })
      .limit(10);

    // Get recent work orders for context
    const { data: workOrders } = await supabase
      .from("work_orders")
      .select("scope, status, created_at")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Build context for AI
    const propertyContext = `
Property: ${property.address}
Borough: ${property.borough || "Unknown"}
Stories: ${property.stories || "Unknown"}
Units: ${property.dwelling_units || "Unknown"}
Year Built: ${property.year_built || "Unknown"}
Zoning: ${property.zoning_district || "Unknown"}
Owner: ${property.owner_name || "Not specified"}

Recent Violations (${violations?.length || 0}):
${violations?.slice(0, 5).map(v => 
  `- ${v.agency} #${v.violation_number} (${v.status}) - ${v.description_raw?.substring(0, 80)}...`
).join("\n") || "No violations on record."}

Work Orders (${workOrders?.length || 0}):
${workOrders?.slice(0, 3).map(w => 
  `- ${w.scope} (${w.status})`
).join("\n") || "No active work orders."}
`.trim();

    const systemPrompt = `You are a helpful property management assistant for ${property.address}. 
You help tenants, vendors, and property managers with questions about the building.
Keep responses concise (under 160 characters if possible, max 320 for SMS).
Be professional but friendly.

${propertyContext}

If asked about something you don't have data for, suggest they contact the property manager directly.
Do not make up information. If you don't know, say so.`;

    // Call Lovable AI for response
    console.log("Calling Lovable AI for response...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body },
        ],
        max_tokens: 150,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || 
      "I'm having trouble processing your request. Please try again or contact the property manager.";

    console.log("AI response:", aiMessage);

    // Log the conversation to activity log
    await supabase.from("property_activity_log").insert({
      property_id: property.id,
      activity_type: "sms_received",
      title: "Inbound SMS",
      description: `From ${from}: ${body.substring(0, 100)}${body.length > 100 ? "..." : ""}`,
      metadata: {
        from,
        message_sid: messageSid,
        message: body,
        ai_response: aiMessage,
      },
    });

    // Return TwiML response with AI message
    const escapedMessage = aiMessage
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`;

    console.log("Sending TwiML response");
    return new Response(twimlResponse, {
      headers: { "Content-Type": "application/xml" },
    });

  } catch (error) {
    console.error("SMS Webhook error:", error);
    
    // Return error as TwiML
    const errorMessage = "Sorry, there was an error processing your message. Please try again later.";
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${errorMessage}</Message>
</Response>`;
    
    return new Response(twimlResponse, {
      headers: { "Content-Type": "application/xml" },
    });
  }
});
