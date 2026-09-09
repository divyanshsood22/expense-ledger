import { getSessionCookie, verifySessionToken } from "./auth.ts";

export async function requireSession(req: Request): Promise<boolean> {
  const token = getSessionCookie(req);
  if (!token) return false;

  const sessionSecret = Deno.env.get("SESSION_SECRET");
  if (!sessionSecret) return false;

  return verifySessionToken(token, sessionSecret);
}