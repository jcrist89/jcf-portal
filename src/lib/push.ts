import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/eventLog";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.");
  }
  webpush.setVapidDetails(process.env.PUSH_CONTACT_EMAIL || "mailto:admin@example.com", publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Sends a push to every device a profile has subscribed on. Best-effort —
 * a dead subscription (410/404) is deleted; other failures are swallowed so
 * one bad device never blocks the rest or the caller's own request. */
export async function sendPushToProfile(profileId: string, payload: PushPayload): Promise<void> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  ensureConfigured();

  const admin = supabaseAdmin();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("profile_id", profileId);
  if (!subs || subs.length === 0) return;

  const json = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, json);
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          // Dead subscription — expected, not a failure worth logging.
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          await logEvent(admin, {
            level: "warning",
            source: "push.send",
            message: "Push notification failed to send",
            context: { statusCode: err?.statusCode ?? null, title: payload.title },
            profileId,
          });
        }
      }
    })
  );
}

/** Fires the message-received push after a coach_notes row is inserted. */
export async function notifyNewMessage(profileId: string, author: "coach" | "client"): Promise<void> {
  const admin = supabaseAdmin();
  if (author === "coach") {
    await sendPushToProfile(profileId, {
      title: "New message from Jon",
      body: "You've got a new note — open Messages to read it.",
      url: "/messages",
    });
    return;
  }

  const [{ data: client }, { data: coaches }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle(),
    admin.from("profiles").select("id").eq("role", "coach").eq("is_active", true),
  ]);
  const name = client?.full_name ?? "A client";
  await Promise.all(
    (coaches ?? []).map((c: any) =>
      sendPushToProfile(c.id, {
        title: "New client message",
        body: `${name} sent you a message.`,
        url: `/coach/clients/${profileId}`,
      })
    )
  );
}

async function notifyAllCoaches(payload: PushPayload): Promise<void> {
  const admin = supabaseAdmin();
  const { data: coaches } = await admin.from("profiles").select("id").eq("role", "coach").eq("is_active", true);
  await Promise.all((coaches ?? []).map((c: any) => sendPushToProfile(c.id, payload)));
}

async function clientName(profileId: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data } = await admin.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  return data?.full_name ?? "A client";
}

/** Fires after a joker-set request is inserted. */
export async function notifyJokerRequested(profileId: string): Promise<void> {
  const name = await clientName(profileId);
  await notifyAllCoaches({
    title: "Joker set requested",
    body: `${name} requested a joker set — review and approve.`,
    url: `/coach/clients/${profileId}`,
  });
}

/** Fires after a coach approves or denies a joker-set request. */
export async function notifyJokerResolved(profileId: string, status: "approved" | "denied"): Promise<void> {
  await sendPushToProfile(profileId, {
    title: status === "approved" ? "Joker set approved" : "Joker set denied",
    body:
      status === "approved"
        ? "Your joker set was approved — open your program for the weight."
        : "Your joker set request was denied.",
    url: "/program",
  });
}

/** Fires after a readiness check-in comes back low or very low. */
export async function notifyLowReadiness(profileId: string, tier: "low" | "very_low"): Promise<void> {
  const name = await clientName(profileId);
  await notifyAllCoaches({
    title: tier === "very_low" ? "Very low readiness" : "Low readiness",
    body: `${name} checked in with ${tier.replace("_", " ")} readiness today.`,
    url: `/coach/clients/${profileId}`,
  });
}

/** Fires after a deviation report is created (weight logged above the prescribed limit). */
export async function notifyDeviationReported(profileId: string): Promise<void> {
  const name = await clientName(profileId);
  await notifyAllCoaches({
    title: "Weight above prescribed limit",
    body: `${name} logged a weight above the prescribed limit — review the session.`,
    url: `/coach/clients/${profileId}`,
  });
}
