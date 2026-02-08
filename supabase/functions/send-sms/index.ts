const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid) {
      throw new Error("TWILIO_ACCOUNT_SID is not configured");
    }
    if (!authToken) {
      throw new Error("TWILIO_AUTH_TOKEN is not configured");
    }
    if (!twilioPhoneNumber) {
      throw new Error("TWILIO_PHONE_NUMBER is not configured");
    }

    const { to, message, type } = await req.json();

    if (!to) {
      throw new Error("Phone number 'to' is required");
    }
    if (!message) {
      throw new Error("Message is required");
    }

    console.log(`Sending SMS to ${to}: ${message.substring(0, 50)}...`);

    // Format phone number (ensure it has +1 prefix for US numbers)
    let formattedTo = to.replace(/\D/g, "");
    if (formattedTo.length === 10) {
      formattedTo = `+1${formattedTo}`;
    } else if (!formattedTo.startsWith("+")) {
      formattedTo = `+${formattedTo}`;
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: twilioPhoneNumber,
        Body: message,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Twilio API error:", responseData);
      throw new Error(
        responseData.message || `Twilio error: ${response.status}`
      );
    }

    console.log(`SMS sent successfully. SID: ${responseData.sid}`);

    return new Response(
      JSON.stringify({
        success: true,
        message_sid: responseData.sid,
        status: responseData.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
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
