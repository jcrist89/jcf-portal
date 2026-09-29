"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={`w-full rounded-xl border border-white/10 bg-jcf-black/25 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-jcf-gray transition-colors hover:border-jcf-danger/40 hover:text-jcf-danger disabled:opacity-50 ${className}`}
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
