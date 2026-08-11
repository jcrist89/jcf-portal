import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseForRequest, type RequestContext } from "@/lib/supabase/server";
import type { Tier } from "@/lib/types";

export type RequestCtx = RequestContext;

export function unauthorized(message = "Not authenticated."): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Not permitted."): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

/** Loads the request-scoped session, or a ready-to-return 401. */
export async function requireSession(): Promise<RequestCtx | NextResponse> {
  const ctx = await supabaseForRequest();
  if (!ctx) return unauthorized();
  return ctx;
}

/** Requires a signed-in coach; returns a ready-to-return 403 otherwise. */
export async function requireCoach(): Promise<RequestCtx | NextResponse> {
  const ctx = await requireSession();
  if (isResponse(ctx)) return ctx;
  if (ctx.session.role !== "coach") return forbidden("Coach access required.");
  return ctx;
}

/**
 * Resolves which profile a request should act on: a client always acts on their
 * own profile regardless of what's in the request body (prevents a client from
 * spoofing another profile's id); a coach may target any profile via `requested`.
 */
export function resolveProfileId(ctx: RequestCtx, requested?: string | null): string {
  if (ctx.session.role === "coach" && requested) return requested;
  return ctx.session.id;
}

/** Requires the caller to either own profileId or be the coach. */
export function requireOwnerOrCoach(ctx: RequestCtx, profileId: string): NextResponse | null {
  if (ctx.session.role === "coach" || ctx.session.id === profileId) return null;
  return forbidden();
}

/**
 * Requires the target profile's tier to be one of allowedTiers. Looks the tier up
 * fresh from the DB (via the request-scoped, RLS-bound client) rather than trusting
 * ctx.session.tier, so it works correctly for a coach acting on a client's profile
 * (whose tier differs from the coach's own session) and isn't vulnerable to a
 * stale snapshot from earlier in the request.
 */
export async function requireTier(
  ctx: RequestCtx,
  profileId: string,
  allowedTiers: Tier[],
): Promise<NextResponse | null> {
  if (ctx.session.role === "coach") return null;
  const { data } = await ctx.client.from("profiles").select("tier").eq("id", profileId).maybeSingle();
  if (!data || !allowedTiers.includes(data.tier as Tier)) {
    return forbidden("This feature isn't included in your current plan.");
  }
  return null;
}

/**
 * Verifies a target id (route param / request body, fully client-controlled)
 * actually refers to an existing client-role profile before an admin-client
 * (RLS-bypassing) write proceeds against it. Defense-in-depth for routes that are
 * already coach-gated but would otherwise trust the id blindly.
 */
export async function requireExistingClient(
  admin: SupabaseClient,
  profileId: string,
): Promise<NextResponse | null> {
  const { data } = await admin.from("profiles").select("id, role").eq("id", profileId).maybeSingle();
  if (!data || data.role !== "client") {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }
  return null;
}
