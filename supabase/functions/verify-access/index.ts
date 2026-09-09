import { withSupabase } from "@supabase/server";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import type { Database } from "../_shared/database.types.ts";
import { hashAccessCode, timingSafeEqualHex, createSessionToken, buildSessionCookieHeader } from "../_shared/auth.ts";

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

export default {
  fetch: withSupabase<Database>({ auth: "none", cors: "disabled" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return handleOptions(req);

    const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
    }

    const supabaseAdmin = ctx.supabaseAdmin; 
    const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const ipHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawIp));
    const ipHash = Array.from(new Uint8Array(ipHashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from("access_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("attempted_at", windowStart);

    if (countError) {
      return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers });
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), { status: 429, headers });
    }

    await supabaseAdmin.from("access_attempts").insert({ ip_hash: ipHash });

    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers });
    }

    const submittedCode = body.code;
    if (!submittedCode || typeof submittedCode !== "string") {
      return new Response(JSON.stringify({ error: "Access code required" }), { status: 400, headers });
    }

    const salt = Deno.env.get("ACCESS_CODE_SALT")!;
    const expectedHash = Deno.env.get("ACCESS_CODE_HASH")!;
    const submittedHash = await hashAccessCode(submittedCode, salt);

    if (!timingSafeEqualHex(submittedHash, expectedHash)) {
      return new Response(JSON.stringify({ error: "Invalid access code" }), { status: 401, headers });
    }

    const sessionSecret = Deno.env.get("SESSION_SECRET")!;
    const token = await createSessionToken(sessionSecret);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...headers, "Set-Cookie": buildSessionCookieHeader(token) },
    });
  }),
};