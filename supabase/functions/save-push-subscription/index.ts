import { withSupabase } from "@supabase/server";
import { corsHeaders, handleOptions, isOriginAllowed } from "../_shared/cors.ts";
import { requireSession } from "../_shared/require-session.ts";
import type { Database } from "../_shared/database.types.ts";

function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  fetch: withSupabase<Database>({ auth: "none", cors: "disabled" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return handleOptions(req);

    const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

    if ((req.method === "POST" || req.method === "DELETE") && !isOriginAllowed(req)) {
      return jsonResponse({ error: "Forbidden" }, 403, headers);
    }

    const authenticated = await requireSession(req);
    if (!authenticated) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    const supabaseAdmin = ctx.supabaseAdmin;

    if (req.method === "POST") {
      let body: { endpoint?: unknown; p256dh?: unknown; auth?: unknown };
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid request body" }, 400, headers);
      }

      const { endpoint, p256dh, auth } = body;
      if (
        typeof endpoint !== "string" || endpoint.length === 0 ||
        typeof p256dh !== "string" || p256dh.length === 0 ||
        typeof auth !== "string" || auth.length === 0
      ) {
        return jsonResponse({ error: "endpoint, p256dh, and auth are all required" }, 400, headers);
      }

      const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
        {
          endpoint,
          p256dh,
          auth_key: auth,
          user_agent: req.headers.get("user-agent") ?? null,
        },
        { onConflict: "endpoint" },
      );

      if (error) return jsonResponse({ error: "Failed to save subscription" }, 500, headers);
      return jsonResponse({ success: true }, 200, headers);
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const endpoint = url.searchParams.get("endpoint");
      if (!endpoint) {
        return jsonResponse({ error: "endpoint query parameter is required" }, 400, headers);
      }

      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);

      if (error) return jsonResponse({ error: "Failed to remove subscription" }, 500, headers);
      return jsonResponse({ success: true }, 200, headers);
    }

    return jsonResponse({ error: "Method not allowed" }, 405, headers);
  }),
};