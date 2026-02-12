import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case "critical": return "#dc2626";
    case "high": return "#ea580c";
    case "medium": return "#ca8a04";
    default: return "#2563eb";
  }
}

function severityBg(severity: string): string {
  switch (severity?.toLowerCase()) {
    case "critical": return "#fef2f2";
    case "high": return "#fff7ed";
    case "medium": return "#fefce8";
    default: return "#eff6ff";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function buildEmailHtml(data: {
  userName: string;
  properties: Array<{
    address: string;
    violations: Array<{ violation_number: string; description_raw: string; severity: string; agency: string; issued_date: string; hearing_date: string | null }>;
    upcomingHearings: Array<{ violation_number: string; hearing_date: string; agency: string; description_raw: string }>;
    expiringDocs: Array<{ document_name: string; expiration_date: string; document_type: string }>;
    applications: Array<{ application_number: string; application_type: string; status: string; agency: string }>;
  }>;
  appUrl: string;
  totalViolations: number;
  totalHearings: number;
  totalExpiring: number;
  totalApplications: number;
  digestDate: string;
}): string {
  const { userName, properties, appUrl, totalViolations, totalHearings, totalExpiring, totalApplications, digestDate } = data;

  const propertySections = properties.map(prop => {
    const hasContent = prop.violations.length > 0 || prop.upcomingHearings.length > 0 || prop.expiringDocs.length > 0 || prop.applications.length > 0;
    if (!hasContent) return "";

    const violationCards = prop.violations.map(v => `
      <div style="background:${severityBg(v.severity)};border-left:4px solid ${severityColor(v.severity)};border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:600;color:#1e293b;font-size:14px;">${v.agency} — ${v.violation_number}</span>
          <span style="background:${severityColor(v.severity)};color:white;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;">${v.severity || "info"}</span>
        </div>
        <p style="color:#475569;font-size:13px;margin:0 0 6px 0;line-height:1.4;">${(v.description_raw || "No description").substring(0, 150)}</p>
        <div style="color:#94a3b8;font-size:12px;">Issued: ${formatDate(v.issued_date)}${v.hearing_date ? ` · Hearing: ${formatDate(v.hearing_date)}` : ""}</div>
      </div>
    `).join("");

    const hearingCards = prop.upcomingHearings.map(h => `
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:#92400e;font-size:14px;margin-bottom:4px;">⚖️ Hearing: ${formatDate(h.hearing_date)}</div>
        <p style="color:#78350f;font-size:13px;margin:0;">${h.agency} ${h.violation_number} — ${(h.description_raw || "").substring(0, 100)}</p>
      </div>
    `).join("");

    const expiringCards = prop.expiringDocs.map(d => `
      <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:#991b1b;font-size:14px;margin-bottom:4px;">📄 Expiring: ${d.document_name}</div>
        <p style="color:#7f1d1d;font-size:13px;margin:0;">${d.document_type} · Expires ${formatDate(d.expiration_date)}</p>
      </div>
    `).join("");

    const appCards = prop.applications.map(a => `
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-weight:600;color:#166534;font-size:14px;margin-bottom:4px;">📋 ${a.agency} — ${a.application_number}</div>
        <p style="color:#15803d;font-size:13px;margin:0;">${a.application_type} · Status: ${a.status || "Pending"}</p>
      </div>
    `).join("");

    return `
      <div style="background:#ffffff;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #e2e8f0;">
        <h2 style="color:#0f172a;font-size:18px;font-weight:700;margin:0 0 16px 0;padding-bottom:12px;border-bottom:2px solid #f1f5f9;">
          🏢 ${prop.address}
        </h2>
        ${violationCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px 0;">Active Violations</h3>${violationCards}` : ""}
        ${hearingCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Upcoming Hearings</h3>${hearingCards}` : ""}
        ${expiringCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Expiring Documents</h3>${expiringCards}` : ""}
        ${appCards ? `<h3 style="color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:16px 0 10px 0;">Application Updates</h3>${appCards}` : ""}
      </div>
    `;
  }).filter(Boolean).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Property Guard Weekly Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px 16px 0 0;padding:32px 28px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">🛡️ Property Guard</div>
      <div style="color:#94a3b8;font-size:14px;margin-top:6px;">Weekly Compliance Digest</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;">${digestDate}</div>
    </div>

    <!-- Stats Bar -->
    <div style="background:#ffffff;padding:20px 28px;display:flex;border-bottom:1px solid #e2e8f0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#dc2626;">${totalViolations}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Violations</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#f59e0b;">${totalHearings}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Hearings</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#ef4444;">${totalExpiring}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Expiring</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:28px;font-weight:800;color:#22c55e;">${totalApplications}</div>
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Applications</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Greeting -->
    <div style="background:#ffffff;padding:24px 28px 16px;border-bottom:1px solid #f1f5f9;">
      <p style="color:#1e293b;font-size:16px;margin:0;">Hi ${userName || "there"},</p>
      <p style="color:#64748b;font-size:14px;margin:8px 0 0;">Here's your weekly compliance summary across all properties.</p>
    </div>

    <!-- Property Sections -->
    <div style="background:#f1f5f9;padding:24px 20px;">
      ${propertySections || '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:14px;">✅ All clear — no active issues this week!</div>'}
    </div>

    <!-- CTA -->
    <div style="background:#ffffff;padding:28px;text-align:center;border-top:1px solid #e2e8f0;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:24px 28px;text-align:center;border-radius:0 0 16px 16px;background:#ffffff;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        You're receiving this because you subscribed to Property Guard digest emails.
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Manage email preferences</a>
        &nbsp;·&nbsp;
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:12px 0 0;">© ${new Date().getFullYear()} Property Guard. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }
    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: { user_id?: string; test_mode?: boolean; preview_only?: boolean } = {};
    try {
      body = await req.json();
    } catch { /* empty */ }

    const userId = body.user_id;
    if (!userId) throw new Error("user_id is required");

    // Get user email from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) throw new Error("User not found");

    const userEmail = user.email;
    if (!userEmail) throw new Error("User has no email");

    // Get profile for display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    // Get user preferences
    const { data: prefs } = await supabase
      .from("email_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    const notifyViolations = prefs?.notify_new_violations ?? true;
    const notifyExpirations = prefs?.notify_expirations ?? true;
    const notifyApplications = prefs?.notify_new_applications ?? true;

    // Get all properties for this user
    const { data: properties } = await supabase
      .from("properties")
      .select("id, address")
      .eq("user_id", userId);

    if (!properties || properties.length === 0) {
      throw new Error("No properties found");
    }

    const propertyIds = properties.map(p => p.id);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel
    const [violationsRes, docsRes, applicationsRes] = await Promise.all([
      notifyViolations
        ? supabase.from("violations").select("*").in("property_id", propertyIds).eq("status", "open").order("severity")
        : Promise.resolve({ data: [] }),
      notifyExpirations
        ? supabase.from("property_documents").select("*").in("property_id", propertyIds).not("expiration_date", "is", null).lte("expiration_date", sevenDaysFromNow.toISOString().split("T")[0])
        : Promise.resolve({ data: [] }),
      notifyApplications
        ? supabase.from("applications").select("*").in("property_id", propertyIds).order("updated_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    const allViolations = violationsRes.data || [];
    const allDocs = docsRes.data || [];
    const allApps = applicationsRes.data || [];

    // Group by property
    const propertyData = properties.map(prop => {
      const violations = allViolations.filter((v: any) => v.property_id === prop.id);
      const upcomingHearings = violations.filter((v: any) => v.hearing_date && new Date(v.hearing_date) <= sevenDaysFromNow && new Date(v.hearing_date) >= now);
      const expiringDocs = allDocs.filter((d: any) => d.property_id === prop.id);
      const applications = allApps.filter((a: any) => a.property_id === prop.id).slice(0, 5);

      return {
        address: prop.address,
        violations: violations.slice(0, 10),
        upcomingHearings,
        expiringDocs,
        applications,
      };
    });

    const totalViolations = allViolations.length;
    const totalHearings = propertyData.reduce((sum, p) => sum + p.upcomingHearings.length, 0);
    const totalExpiring = allDocs.length;
    const totalApplications = allApps.length;

    const appUrl = "https://id-preview--9d9b6494-36da-4c50-a4c2-79428913d706.lovable.app";
    const digestDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const html = buildEmailHtml({
      userName: profile?.display_name || "",
      properties: propertyData,
      appUrl,
      totalViolations,
      totalHearings,
      totalExpiring,
      totalApplications,
      digestDate,
    });

    // Preview mode — return HTML without sending
    if (body.preview_only) {
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Property Guard <onboarding@resend.dev>",
        to: [userEmail],
        subject: `🛡️ Weekly Compliance Digest — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        html,
      }),
    });

    const resendResult = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendResult);
      throw new Error(`Failed to send email: ${JSON.stringify(resendResult)}`);
    }

    // Log
    await supabase.from("email_log").insert({
      user_id: userId,
      email_type: body.test_mode ? "test_digest" : "digest",
      subject: `Weekly Compliance Digest — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      recipient_email: userEmail,
      metadata: {
        total_violations: totalViolations,
        total_hearings: totalHearings,
        total_expiring: totalExpiring,
        total_applications: totalApplications,
        properties_count: properties.length,
        resend_id: resendResult.id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, resend_id: resendResult.id, preview_available: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email digest error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
