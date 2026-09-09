import { withSupabase } from "@supabase/server";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireSession } from "../_shared/require-session.ts";
import type { Database } from "../_shared/database.types.ts";

function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  fetch: withSupabase<Database>({ auth: "none", cors: "disabled" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return handleOptions(req);

    const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

    const authenticated = await requireSession(req);
    if (!authenticated) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    if (req.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    const { data, error } = await ctx.supabaseAdmin
      .from("historical_monthly_summaries")
      .select("year, month, total_paise")
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    if (error) return jsonResponse({ error: "Failed to fetch summaries" }, 500, headers);
    return jsonResponse({ summaries: data }, 200, headers);
  }),
};