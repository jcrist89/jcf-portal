import type { SupabaseClient } from "@supabase/supabase-js";
import { buildWelcomeEmail } from "./welcome";
import { sendMail } from "./mailer";
import type { Tier } from "@/lib/types";

/**
 * Sends the tier-based welcome email at most once per profile. The update
 * doubles as the dedup lock: it only writes (and only "wins") when
 * welcome_email_sent_at is still null, so concurrent callers (e.g. a retried
 * Stripe webhook) can't both send it.
 */
export async function sendWelcomeEmailOnce(
  supabase: SupabaseClient,
  profile: { id: string; email: string | null; full_name: string | null; tier: Tier }
) {
  if (!profile.email) return;

  const { data: claimed } = await supabase
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", profile.id)
    .is("welcome_email_sent_at", null)
    .select("id")
    .maybeSingle();

  if (!claimed) return;

  const { subject, html, text } = buildWelcomeEmail(profile.tier, profile.full_name);
  await sendMail({ to: profile.email, subject, html, text });
}
