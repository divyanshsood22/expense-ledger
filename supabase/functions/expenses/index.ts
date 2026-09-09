import { withSupabase } from "@supabase/server";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireSession } from "../_shared/require-session.ts";
import { todayInIST } from "../_shared/dates.ts";
import type { Database } from "../_shared/database.types.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DESCRIPTION_LENGTH = 500;

function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/** Validates and normalizes a submitted amount. Must be a positive integer (paise). */
function parseAmountPaise(value: unknown): number | null {
  if (
  typeof value !== "number" ||
  !Number.isSafeInteger(value) ||
  value <= 0
) return null;
  return value;
}

/** Validates and normalizes a submitted description. Empty string is treated as "not provided". */
function parseDescription(value: unknown): string | null | undefined {
  if (value === undefined) return undefined; // not provided at all
  if (value === null) return null; // explicitly cleared
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) return undefined;
  return trimmed;
}

export default {
  fetch: withSupabase<Database>({ auth: "none", cors: "disabled" }, async (req, ctx) => {
    if (req.method === "OPTIONS") return handleOptions(req);

    const headers = { ...corsHeaders(req), "Content-Type": "application/json" };

    const authenticated = await requireSession(req);
    if (!authenticated) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    const supabaseAdmin = ctx.supabaseAdmin;
    const url = new URL(req.url);

    switch (req.method) {
      case "GET": {
        const { data, error } = await supabaseAdmin
          .from("expenses")
          .select("*")
          .order("expense_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ error: "Failed to fetch expenses" }, 500, headers);
        return jsonResponse({ expenses: data }, 200, headers);
      }

      case "POST": {
        let body: { amount_paise?: unknown; description?: unknown };
        try {
          body = await req.json();
        } catch {
          return jsonResponse({ error: "Invalid request body" }, 400, headers);
        }

        const amountPaise = parseAmountPaise(body.amount_paise);
        if (amountPaise === null) {
          return jsonResponse({ error: "amount_paise must be a positive integer" }, 400, headers);
        }

        const description = parseDescription(body.description);
        if (description === undefined && body.description !== undefined) {
          return jsonResponse({ error: "description is invalid or too long" }, 400, headers);
        }

        const { data, error } = await supabaseAdmin
          .from("expenses")
          .insert({
            amount_paise: amountPaise,
            description: description ?? null,
            expense_date: todayInIST(), // server-computed — never client-supplied
          })
          .select("*")
          .single();

        if (error) return jsonResponse({ error: "Failed to create expense" }, 500, headers);
        return jsonResponse(data, 201, headers);
      }

      case "PATCH": {
        const id = url.searchParams.get("id");
        if (!id || !UUID_RE.test(id)) {
          return jsonResponse({ error: "A valid id query parameter is required" }, 400, headers);
        }

        let body: { amount_paise?: unknown; description?: unknown };
        try {
          body = await req.json();
        } catch {
          return jsonResponse({ error: "Invalid request body" }, 400, headers);
        }

        const updates: {
  amount_paise?: number;
  description?: string | null;
  updated_at?: string;
} = {};

        if (body.amount_paise !== undefined) {
          const amountPaise = parseAmountPaise(body.amount_paise);
          if (amountPaise === null) {
            return jsonResponse({ error: "amount_paise must be a positive integer" }, 400, headers);
          }
          updates.amount_paise = amountPaise;
        }

        if (body.description !== undefined) {
          const description = parseDescription(body.description);
          if (description === undefined) {
            return jsonResponse({ error: "description is invalid or too long" }, 400, headers);
          }
          updates.description = description;
        }

        if (Object.keys(updates).length === 0) {
          return jsonResponse({ error: "At least one of amount_paise or description is required" }, 400, headers);
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
          .from("expenses")
          .update(updates)
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return jsonResponse({ error: "Failed to update expense" }, 500, headers);
        if (!data) return jsonResponse({ error: "Expense not found" }, 404, headers);
        return jsonResponse(data, 200, headers);
      }

      case "DELETE": {
        const id = url.searchParams.get("id");
        if (!id || !UUID_RE.test(id)) {
          return jsonResponse({ error: "A valid id query parameter is required" }, 400, headers);
        }

        const { data, error } = await supabaseAdmin
          .from("expenses")
          .delete()
          .eq("id", id)
          .select("id")
          .maybeSingle();

        if (error) return jsonResponse({ error: "Failed to delete expense" }, 500, headers);
        if (!data) return jsonResponse({ error: "Expense not found" }, 404, headers);
        return jsonResponse({ deleted: true, id: data.id }, 200, headers);
      }

      default:
        return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }
  }),
};