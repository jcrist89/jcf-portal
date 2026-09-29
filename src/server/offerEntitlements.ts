import type { SupabaseClient } from "@supabase/supabase-js";

export interface OfferEntitlements {
  checkins?: boolean;
  coaching?: boolean;
  messaging?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * Reads the service-level entitlements from the offer record.
 *
 * The commercial offer is the source of truth for whether a feature was sold.
 * That keeps Local Coaching from accidentally inheriting Remote Coaching's
 * weekly check-in workflow just because both are represented by engagements.
 */
export async function loadOfferEntitlements(
  client: SupabaseClient,
  offerCode: string | null | undefined,
): Promise<OfferEntitlements> {
  if (!offerCode) return {};

  const { data, error } = await client
    .from("offers")
    .select("entitlements")
    .eq("code", offerCode)
    .maybeSingle();

  if (error || !data?.entitlements || typeof data.entitlements !== "object") return {};
  const raw = data.entitlements as Record<string, unknown>;
  return {
    checkins: raw.checkins === true,
    coaching: raw.coaching === true,
    messaging: raw.messaging === true,
  };
}
