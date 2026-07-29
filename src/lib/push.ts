import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
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
