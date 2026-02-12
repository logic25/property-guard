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
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response("OK", { status: 200 });
    }

    const update = await req.json();
    console.log("Telegram update:", JSON.stringify(update).slice(0, 500));

    const message = update.message;
    if (!message || !message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const username = message.from?.username || null;
    const firstName = message.from?.first_name || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle /start command with linking code
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) {
        const linkCode = parts[1];
        // linkCode = base64-encoded user_id
        try {
          const userId = atob(linkCode);
          // Check if UUID format
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            // Upsert telegram_users
            const { error } = await supabase
              .from("telegram_users")
              .upsert(
                {
                  user_id: userId,
                  chat_id: chatId,
                  username,
                  first_name: firstName,
                  is_active: true,
                },
                { onConflict: "chat_id" }
              );

            if (error) {
              console.error("Error linking user:", error);
              await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "❌ Failed to link account. Please try again.");
            } else {
              await sendTelegram(
                TELEGRAM_BOT_TOKEN,
                chatId,
                `✅ *Account linked!*\n\nWelcome to Property Guard, ${firstName || "there"}! You can now:\n\n• Ask about your properties and violations\n• Get daily compliance digests\n• Query hearings and deadlines\n\nTry: _"Show violations for 123 Main St"_`,
                "Markdown"
              );
            }
            return new Response("OK", { status: 200 });
          }
        } catch {
          // Invalid base64, fall through to welcome
        }
      }

      await sendTelegram(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `👋 *Welcome to Property Guard Bot!*\n\nTo get started, link your account from the Settings page in Property Guard.\n\nOnce linked, you can:\n• Query violations by property\n• Get compliance status updates\n• Receive daily digests`,
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    // Handle /help
    if (text === "/help") {
      await sendTelegram(
        TELEGRAM_BOT_TOKEN,
        chatId,
        `📋 *Property Guard Bot Commands*\n\n• Just type a question about your properties\n• _"Violations at 123 Main St"_\n• _"Compliance status for all properties"_\n• _"Upcoming hearings this week"_\n• _"Tax status for 456 Oak Ave"_\n\n/status — Quick portfolio overview\n/unlink — Disconnect your account\n/help — Show this message`,
        "Markdown"
      );
      return new Response("OK", { status: 200 });
    }

    // Handle /unlink
    if (text === "/unlink") {
      await supabase
        .from("telegram_users")
        .update({ is_active: false })
        .eq("chat_id", chatId);

      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "✅ Account unlinked. You'll no longer receive alerts.");
      return new Response("OK", { status: 200 });
    }

    // Look up linked user
    const { data: telegramUser } = await supabase
      .from("telegram_users")
      .select("user_id, is_active")
      .eq("chat_id", chatId)
      .single();

    if (!telegramUser || !telegramUser.is_active) {
      await sendTelegram(
        TELEGRAM_BOT_TOKEN,
        chatId,
        "⚠️ Your account is not linked. Please link from Settings in Property Guard."
      );
      return new Response("OK", { status: 200 });
    }

    const userId = telegramUser.user_id;

    // Handle /status command
    if (text === "/status") {
      const summary = await getPortfolioSummary(supabase, userId);
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, summary, "Markdown");
      return new Response("OK", { status: 200 });
    }

    // AI-powered query: fetch property context and ask AI
    const propertyContext = await getPropertyContext(supabase, userId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ AI service not configured.");
      return new Response("OK", { status: 200 });
    }

    const systemPrompt = `You are Property Guard Bot, a Telegram assistant for NYC property owners.
You have access to the user's property portfolio data below. Answer questions concisely for Telegram (max 4000 chars).
Use Markdown formatting sparingly (bold for emphasis, bullet points for lists).
If the user asks about a property not in their portfolio, say so.
If you can't determine the answer from the data, say so honestly.

PORTFOLIO DATA:
${propertyContext}

RULES:
- Be brief and direct — this is Telegram, not a report
- Reference specific violation numbers, dates, amounts
- For compliance questions, check both violations AND compliance_requirements
- For tax questions, check property_taxes data
- Always mention the property address when referencing data`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI error:", aiResponse.status);
      if (aiResponse.status === 429) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ Rate limit reached. Please try again in a moment.");
      } else if (aiResponse.status === 402) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ AI credits depleted. Contact admin.");
      } else {
        await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, "⚠️ Error processing your request. Please try again.");
      }
      return new Response("OK", { status: 200 });
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "No response generated.";

    // Telegram max message length is 4096
    const truncatedReply = reply.length > 4000 ? reply.slice(0, 4000) + "\n\n_...truncated_" : reply;
    await sendTelegram(TELEGRAM_BOT_TOKEN, chatId, truncatedReply, "Markdown");

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return new Response("OK", { status: 200 });
  }
});

async function sendTelegram(token: string, chatId: number, text: string, parseMode?: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Telegram sendMessage error:", errText);
    // Retry without parse_mode if markdown fails
    if (parseMode) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    }
  }
}

async function getPortfolioSummary(supabase: any, userId: string): string {
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address")
    .eq("user_id", userId);

  if (!properties || properties.length === 0) {
    return "📊 *Portfolio Status*\n\nNo properties found in your account.";
  }

  const propertyIds = properties.map((p: any) => p.id);

  const { data: violations } = await supabase
    .from("violations")
    .select("id, status, severity, is_stop_work_order, is_vacate_order")
    .in("property_id", propertyIds)
    .eq("status", "open");

  const openViolations = violations?.length || 0;
  const critical = violations?.filter(
    (v: any) => v.severity === "critical" || v.is_stop_work_order || v.is_vacate_order
  ).length || 0;

  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("id, status")
    .in("property_id", propertyIds)
    .in("status", ["open", "in_progress"]);

  const { data: taxes } = await supabase
    .from("property_taxes")
    .select("balance_due")
    .in("property_id", propertyIds)
    .gt("balance_due", 0);

  const totalTaxDue = taxes?.reduce((sum: number, t: any) => sum + (t.balance_due || 0), 0) || 0;

  let msg = `📊 *Portfolio Status*\n\n`;
  msg += `🏢 Properties: *${properties.length}*\n`;
  msg += `⚠️ Open Violations: *${openViolations}*`;
  if (critical > 0) msg += ` (🔴 ${critical} critical)`;
  msg += `\n`;
  msg += `📋 Active Work Orders: *${workOrders?.length || 0}*\n`;
  if (totalTaxDue > 0) msg += `💰 Tax Balance Due: *$${totalTaxDue.toLocaleString()}*\n`;

  return msg;
}

async function getPropertyContext(supabase: any, userId: string): string {
  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, borough, bin, bbl, stories, dwelling_units, year_built, zoning_district, compliance_status")
    .eq("user_id", userId);

  if (!properties || properties.length === 0) return "No properties found.";

  let context = "";

  for (const prop of properties) {
    context += `\n--- PROPERTY: ${prop.address} ---\n`;
    context += `Borough: ${prop.borough || "N/A"}, BIN: ${prop.bin || "N/A"}, BBL: ${prop.bbl || "N/A"}\n`;
    context += `Stories: ${prop.stories || "N/A"}, Units: ${prop.dwelling_units || "N/A"}, Built: ${prop.year_built || "N/A"}\n`;

    // Violations
    const { data: violations } = await supabase
      .from("violations")
      .select("violation_number, agency, status, severity, issued_date, description_raw, hearing_date, penalty_amount, is_stop_work_order, is_vacate_order")
      .eq("property_id", prop.id)
      .eq("status", "open")
      .order("issued_date", { ascending: false })
      .limit(20);

    if (violations && violations.length > 0) {
      context += `Open Violations (${violations.length}):\n`;
      for (const v of violations) {
        context += `  • ${v.agency} #${v.violation_number} (${v.severity || "normal"}) - ${v.description_raw?.slice(0, 80) || "No description"}`;
        if (v.hearing_date) context += ` | Hearing: ${v.hearing_date}`;
        if (v.penalty_amount) context += ` | Penalty: $${v.penalty_amount}`;
        if (v.is_stop_work_order) context += " ⛔ SWO";
        if (v.is_vacate_order) context += " 🚨 VACATE";
        context += "\n";
      }
    } else {
      context += "Open Violations: None\n";
    }

    // Compliance
    const { data: compliance } = await supabase
      .from("compliance_requirements")
      .select("local_law, requirement_name, status, due_date")
      .eq("property_id", prop.id)
      .in("status", ["pending", "overdue"]);

    if (compliance && compliance.length > 0) {
      context += `Compliance Items:\n`;
      for (const c of compliance) {
        context += `  • ${c.local_law}: ${c.requirement_name} — ${c.status}${c.due_date ? ` (due ${c.due_date})` : ""}\n`;
      }
    }

    // Taxes
    const { data: taxes } = await supabase
      .from("property_taxes")
      .select("tax_year, payment_status, balance_due, protest_status")
      .eq("property_id", prop.id)
      .order("tax_year", { ascending: false })
      .limit(3);

    if (taxes && taxes.length > 0) {
      context += `Recent Taxes:\n`;
      for (const t of taxes) {
        context += `  • ${t.tax_year}: ${t.payment_status}${t.balance_due ? ` ($${t.balance_due} due)` : ""}${t.protest_status ? ` | Protest: ${t.protest_status}` : ""}\n`;
      }
    }
  }

  return context;
}
