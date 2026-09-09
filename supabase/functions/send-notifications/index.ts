import webpush from "web-push";
import { withSupabase } from "@supabase/server";
import { todayInIST, isLastDayOfMonthIST } from "../_shared/dates.ts";
import { formatPaiseINR } from "../_shared/money.ts";
import type { Database } from "../_shared/database.types.ts";

interface NotificationPayload {
  title: string;
  body: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Sends one payload to every given subscription. Returns the ids of subscriptions
 *  that are dead (404/410 from the push service) so the caller can remove them. */
async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: NotificationPayload,
): Promise<string[]> {
  const staleIds: string[] = [];
  const payloadJson = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payloadJson,
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(sub.id); // subscription no longer exists on the push service
        } else {
          console.error(`Push failed for subscription ${sub.id}:`, err);
        }
      }
    }),
  );

  return staleIds;
}

export default {
  fetch: withSupabase<Database>({ auth: "none", cors: "disabled" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const cronSecret = req.headers.get("x-cron-secret");
    if (!cronSecret || cronSecret !== Deno.env.get("CRON_SECRET")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    const supabaseAdmin = ctx.supabaseAdmin;

    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key");

    if (subsError) {
      return jsonResponse({ error: "Failed to load subscriptions" }, 500);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return jsonResponse({ sent: false, reason: "No push subscriptions registered" }, 200);
    }

    const staleIds = new Set<string>();
    const results: Record<string, unknown> = {};

    // --- Daily notification ---
    const today = todayInIST();
    const { data: todayExpenses, error: todayError } = await supabaseAdmin
      .from("expenses")
      .select("amount_paise")
      .eq("expense_date", today);

    if (todayError) {
      return jsonResponse({ error: "Failed to compute daily total" }, 500);
    }

    const dailyTotalPaise = (todayExpenses ?? []).reduce((sum, e) => sum + e.amount_paise, 0);
    const dailyStale = await sendPushToSubscriptions(subscriptions, {
      title: "Expense Ledger",
      body: `Today's spending: ${formatPaiseINR(dailyTotalPaise)}`,
    });
    dailyStale.forEach((id) => staleIds.add(id));
    results.daily = { total_paise: dailyTotalPaise, sent_to: subscriptions.length - dailyStale.length };

    // --- Monthly notification (only on the last day of the month) ---
    if (isLastDayOfMonthIST()) {
      const currentMonth = today.slice(0, 7); // 'YYYY-MM'
      const [year, month] = currentMonth.split("-").map(Number);

      // Checked for consistency with History/Analytics' "summary takes priority"
      // pattern. In normal operation this will never match for the *current*
      // month — historical_monthly_summaries only covers past, pre-tracking
      // months (Mar-Aug 2026) — but this keeps the logic aligned rather than
      // silently assuming that will always be true.
      const { data: summary } = await supabaseAdmin
        .from("historical_monthly_summaries")
        .select("total_paise")
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      let monthlyTotalPaise: number;
      if (summary) {
        monthlyTotalPaise = summary.total_paise;
      } else {
        const { data: monthExpenses, error: monthError } = await supabaseAdmin
          .from("expenses")
          .select("amount_paise")
          .gte("expense_date", `${currentMonth}-01`)
          .lte("expense_date", today);

        if (monthError) {
          return jsonResponse({ error: "Failed to compute monthly total" }, 500);
        }
        monthlyTotalPaise = (monthExpenses ?? []).reduce((sum, e) => sum + e.amount_paise, 0);
      }

      const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
        month: "long",
        timeZone: "UTC",
      });

      const monthlyStale = await sendPushToSubscriptions(subscriptions, {
        title: "Expense Ledger",
        body: `${monthLabel} spending: ${formatPaiseINR(monthlyTotalPaise)}`,
      });
      monthlyStale.forEach((id) => staleIds.add(id));
      results.monthly = {
        total_paise: monthlyTotalPaise,
        sent_to: subscriptions.length - monthlyStale.length,
      };
    }

    if (staleIds.size > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", Array.from(staleIds));
    }

    return jsonResponse({ success: true, ...results, removed_stale: staleIds.size }, 200);
  }),
};