import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      messages, 
      propertyId, 
      propertyData, 
      violationsSummary, 
      documentTypes, 
      workOrdersSummary 
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context about this property
    const propertyContext = `
PROPERTY INFORMATION:
- Address: ${propertyData?.address || 'Unknown'}
- Borough: ${propertyData?.borough || 'N/A'}
- BIN: ${propertyData?.bin || 'N/A'}
- BBL: ${propertyData?.bbl || 'N/A'}
- Stories: ${propertyData?.stories || 'N/A'}
- Dwelling Units: ${propertyData?.dwelling_units || 'N/A'}
- Year Built: ${propertyData?.year_built || 'N/A'}
- Zoning: ${propertyData?.zoning_district || 'N/A'}
- Building Class: ${propertyData?.building_class || 'N/A'}
- CO Status: ${propertyData?.co_status || 'Unknown'}

VIOLATIONS SUMMARY:
- Total violations: ${violationsSummary?.total || 0}
- Open: ${violationsSummary?.open || 0}
- In Progress: ${violationsSummary?.inProgress || 0}
- Has critical issues (stop work/vacate): ${violationsSummary?.hasCritical ? 'Yes' : 'No'}

DOCUMENTS ON FILE:
${documentTypes?.length ? documentTypes.join(', ') : 'None'}

WORK ORDERS:
- Total: ${workOrdersSummary?.total || 0}
- Active: ${workOrdersSummary?.active || 0}
`;

    // System prompt that restricts to property-related topics
    const systemPrompt = `You are a property management assistant for a specific building. You MUST follow these strict rules:

1. ONLY answer questions related to this specific property, its violations, documents, work orders, compliance, or general property management topics that apply to it.

2. If asked about topics NOT related to this property or property management (like politics, sports, cooking, personal advice, etc.), politely decline:
   "I can only help with questions about this property and its management. Try asking about violations, documents, deadlines, zoning, or compliance."

3. Be direct and concise. Use bullet points for lists.

4. When discussing violations or deadlines, be specific about what actions might be needed.

5. For questions about specific document contents (like lease terms), explain that you can see the document types but would need the actual content to answer specific questions.

6. Never provide legal, financial, or tax advice. Say: "For legal/financial matters, please consult a professional."

7. If you don't have enough information to answer, say so clearly.

${propertyContext}

When answering:
- Reference specific data from the property context above
- Highlight urgent issues (like critical violations)
- Be helpful for property management decisions`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Property AI error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
