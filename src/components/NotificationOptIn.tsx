"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function NotificationOptIn({ role }: { role: "coach" | "client" }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window);
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("Push notifications aren't configured yet.");
        return;
      }
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) setError("Could not save your subscription.");
    } catch {
      setError("Could not enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  const copy =
    role === "coach"
      ? "Get a push the moment a client messages you."
      : "Get a push when Jon sends you a note, or when your streak's at risk.";

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-2">Notifications</h3>
      {permission === "denied" ? (
        <p className="text-jcf-gray text-xs">
          Notifications are blocked for this site in your browser/device settings — enable them there to turn this
          on.
        </p>
      ) : permission === "granted" ? (
        <>
          <p className="text-jcf-gray text-xs mb-3">Push notifications are on for this device.</p>
          <Button variant="secondary" onClick={disable} disabled={busy}>
            {busy ? "Working..." : "Turn Off"}
          </Button>
        </>
      ) : (
        <>
          <p className="text-jcf-gray text-xs mb-3">{copy}</p>
          <Button onClick={enable} disabled={busy}>
            {busy ? "Enabling..." : "Enable Notifications"}
          </Button>
        </>
      )}
      {error && <p className="text-jcf-danger text-xs mt-2">{error}</p>}
    </div>
  );
}
