import { withSupabase } from "@supabase/server";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getSessionCookie, verifySessionToken } from "../_shared/auth.ts";

export default {
  fetch: withSupabase({ auth: "none", cors: "disabled" }, async (req) => {
    if (req.method === "OPTIONS") return handleOptions(req);

    const headers = {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    };

    const token = getSessionCookie(req);

    if (!token) {
      return new Response(
        JSON.stringify({ authenticated: false }),
        { status: 401, headers },
      );
    }

    const sessionSecret = Deno.env.get("SESSION_SECRET");

    if (!sessionSecret) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers },
      );
    }

    const valid = await verifySessionToken(token, sessionSecret);

    if (!valid) {
      return new Response(
        JSON.stringify({ authenticated: false }),
        { status: 401, headers },
      );
    }

    return new Response(
      JSON.stringify({ authenticated: true }),
      { status: 200, headers },
    );
  }),
};