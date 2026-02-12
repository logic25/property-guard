import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function buildChangeSummaryHtml(data: {
  userName: string;
  properties: Array<{
    address: string;
    changes: Array<{
      entity_type: string;
      change_type: string;
      entity_label: string;
      description: string;
      previous_value: string | null;
      new_value: string | null;
      created_at: string;
    }>;
  }>;
  totalChanges: number;
  appUrl: string;
  date: string;
}): string {
  const { userName, properties, totalChanges, appUrl, date } = data;

  const propertyBlocks = properties.map(prop => {
    const changeRows = prop.changes.map(c => {
      const icon = c.entity_type === 'violation' ? '⚠️' : '📋';
      const typeBg = c.change_type === 'new' ? '#dcfce7' : '#fef3c7';
      const typeColor = c.change_type === 'new' ? '#166534' : '#92400e';
      const typeLabel = c.change_type === 'new' ? 'NEW' : 'CHANGED';

      return `
        <div style="border-bottom:1px solid #f1f5f9;padding:12px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;vertical-align:top;padding-top:2px;">${icon}</td>
            <td>
              <div style="margin-bottom:4px;">
                <span style="font-weight:600;color:#1e293b;font-size:13px;">${c.entity_label}</span>
                <span style="background:${typeBg};color:${typeColor};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:8px;text-transform:uppercase;">${typeLabel}</span>
              </div>
              <p style="color:#64748b;font-size:12px;margin:0;line-height:1.4;">${c.description}</p>
              ${c.change_type === 'status_change' ? `<p style="color:#94a3b8;font-size:11px;margin:4px 0 0;"><strong>${c.previous_value}</strong> → <strong style="color:#0f172a;">${c.new_value}</strong></p>` : ''}
              <p style="color:#cbd5e1;font-size:10px;margin:4px 0 0;">${formatDate(c.created_at)}</p>
            </td>
          </tr></table>
        </div>
      `;
    }).join("");

    return `
      <div style="background:#ffffff;border-radius:12px;padding:24px;margin-bottom:16px;border:1px solid #e2e8f0;">
        <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 12px;">🏢 ${prop.address}</h3>
        ${changeRows}
      </div>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
      <div style="font-size:24px;font-weight:800;color:#ffffff;">🛡️ Property Guard</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Daily Change Summary</div>
      <div style="color:#64748b;font-size:12px;margin-top:4px;">${date}</div>
    </div>

    <div style="background:#ffffff;padding:20px 32px;text-align:center;border-bottom:1px solid #e2e8f0;">
      <div style="font-size:36px;font-weight:800;color:#0f172a;">${totalChanges}</div>
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;font-weight:600;">Changes Detected</div>
    </div>

    <div style="background:#ffffff;padding:20px 32px 12px;border-bottom:1px solid #f1f5f9;">
      <p style="color:#1e293b;font-size:15px;margin:0;">Hi ${userName || "there"},</p>
      <p style="color:#64748b;font-size:13px;margin:6px 0 0;">Here's what changed across your properties since the last sync.</p>
    </div>

    <div style="background:#f1f5f9;padding:24px 20px;">
      ${propertyBlocks}
    </div>

    <div style="background:#ffffff;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <a href="${appUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#334155);color:#ffffff;padding:12px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:13px;">
        Review Changes →
      </a>
    </div>

    <div style="background:linear-gradient(135deg,#fef3c7,#fff7ed);padding:24px 32px;text-align:center;border-top:1px solid #fde68a;">
      <p style="color:#92400e;font-size:15px;font-weight:700;margin:0 0 6px;">Need help with compliance?</p>
      <p style="color:#78350f;font-size:12px;margin:0 0 14px;">GLE Expediting handles DOB violations, permits, and hearings.</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;">
        <a href="tel:+17186127171" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:12px;margin:0 4px;">📞 (718) 612-7171</a>
        <a href="mailto:info@gleexpediting.com" style="display:inline-block;background:#ea580c;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:12px;margin:0 4px;">✉️ Email GLE</a>
      </td></tr></table>
    </div>

    <div style="padding:20px 32px;text-align:center;border-radius:0 0 16px 16px;background:#fff;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">
        <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Manage preferences</a> · <a href="${appUrl}/dashboard/settings" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>
      </p>
      <p style="color:#cbd5e1;font-size:10px;margin:8px 0 0;">© ${new Date().getFullYear()} Property Guard</p>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase env");
    if (!resendApiKey) throw new Error("Missing RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all un-notified changes grouped by user
    const { data: changes, error: changeError } = await supabase
      .from("change_log")
      .select("*")
      .eq("notified", false)
      .order("created_at", { ascending: false })
      .limit(500);

    if (changeError) throw changeError;
    if (!changes || changes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No changes to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user_id
    const byUser = new Map<string, any[]>();
    for (const c of changes) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
      byUser.get(c.user_id)!.push(c);
    }

    let emailsSent = 0;
    const changeIds: string[] = [];

    for (const [userId, userChanges] of byUser) {
      try {
        // Check user preferences
        const { data: prefs } = await supabase.from("email_preferences").select("*").eq("user_id", userId).single();
        if (prefs && !(prefs.notify_status_changes ?? true)) continue;

        // Get user info
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        if (!user?.email) continue;

        const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", userId).single();

        // Get property addresses
        const propertyIds = [...new Set(userChanges.map(c => c.property_id))];
        const { data: propData } = await supabase.from("properties").select("id, address").in("id", propertyIds);
        const propMap = new Map((propData || []).map(p => [p.id, p.address]));

        // Group changes by property
        const byProperty = new Map<string, any[]>();
        for (const c of userChanges) {
          const addr = propMap.get(c.property_id) || "Unknown";
          if (!byProperty.has(addr)) byProperty.set(addr, []);
          byProperty.get(addr)!.push(c);
        }

        const propertyData = Array.from(byProperty.entries()).map(([address, changes]) => ({
          address,
          changes: changes.map(c => ({
            entity_type: c.entity_type,
            change_type: c.change_type,
            entity_label: c.entity_label,
            description: c.description,
            previous_value: c.previous_value,
            new_value: c.new_value,
            created_at: c.created_at,
          })),
        }));

        const appUrl = "https://id-preview--9d9b6494-36da-4c50-a4c2-79428913d706.lovable.app";
        const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

        const html = buildChangeSummaryHtml({
          userName: profile?.display_name || "",
          properties: propertyData,
          totalChanges: userChanges.length,
          appUrl,
          date,
        });

        // Send email
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Property Guard <onboarding@resend.dev>",
            to: [user.email],
            subject: `🔄 ${userChanges.length} changes detected — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
            html,
          }),
        });

        if (resendRes.ok) {
          emailsSent++;
          changeIds.push(...userChanges.map(c => c.id));

          // Log the email
          await supabase.from("email_log").insert({
            user_id: userId,
            email_type: "change_summary",
            subject: `${userChanges.length} changes detected`,
            recipient_email: user.email,
            metadata: { total_changes: userChanges.length, properties_count: propertyIds.length },
          });
        } else {
          const err = await resendRes.json();
          console.error("Resend error:", err);
        }
      } catch (e) {
        console.error(`Error sending summary to user ${userId}:`, e);
      }
    }

    // Mark changes as notified
    if (changeIds.length > 0) {
      await supabase.from("change_log").update({ notified: true }).in("id", changeIds);
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent, changes_notified: changeIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Change summary error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
