import "server-only";
import { ForbiddenError } from "./auth/rbac";
import { getCurrentUser } from "./auth/session";
import { ServiceError } from "./services/common";

/**
 * Helpers for the REST API (app/api/v1).
 *
 * Public GETs are cacheable and CORS-open (any front end can read published
 * content). Writes require a signed-in session AND a same-origin request —
 * a browser on another site can't ride the session cookie (CSRF).
 */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export function publicJson(data: unknown, maxAge = 60) {
  return Response.json(
    { data },
    { headers: { ...CORS, "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=600` } },
  );
}

export function error(status: number, message: string, fields?: Record<string, string>) {
  return Response.json({ error: { message, fields } }, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** wraps an authenticated write: session + CSRF check + error mapping */
export async function write(req: Request, fn: (user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<unknown>, status = 200) {
  if (!sameOrigin(req)) return error(403, "Cross-site request rejected.");
  const user = await getCurrentUser();
  if (!user) return error(401, "Sign in required.");
  try {
    const data = await fn(user);
    return Response.json({ data: data ?? null }, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ServiceError) return error(e.status, e.message, e.fields);
    if (e instanceof ForbiddenError) return error(403, e.message);
    console.error("[cms api]", e);
    return error(500, "Internal error.");
  }
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new ServiceError("Body must be JSON.", 400);
  }
}

export const options = () => new Response(null, { status: 204, headers: CORS });
