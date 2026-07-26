"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JcfWordmark } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { getBrowserClient } from "@/lib/supabase/browser";

/**
 * Landing page for every auth email link (invite, password reset). Supabase's
 * email links can arrive in three different shapes depending on project/template
 * config — a `code` query param (PKCE), a `token_hash` + `type` query param pair,
 * or session tokens in the URL hash fragment (`#access_token=...`, the classic
 * default template). Fragments never reach the server, so this all has to be
 * resolved client-side rather than in a route handler — we try each mechanism
 * that could apply, then fall back to just checking whether a session already
 * exists (which is what happens for the hash-fragment case, since supabase-js
 * auto-detects and consumes it from the URL on client init).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const supabase = getBrowserClient();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      // @supabase/ssr forces flowType: "pkce", which means its own automatic
      // detectSessionInUrl only ever looks for a `code` param — it does NOT
      // parse the classic implicit-flow hash fragment
      // (#access_token=...&refresh_token=...&type=recovery), which is exactly
      // what this project's email links use. Left unhandled, getSession() below
      // would silently fall through to whatever session already happened to be
      // in cookies rather than the one this link is actually carrying. So parse
      // the hash ourselves and set it explicitly.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } else if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (tokenHash && type) {
        await supabase.auth.verifyOtp({ type: type as "recovery" | "invite" | "email", token_hash: tokenHash });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      window.history.replaceState(null, "", window.location.pathname);
      setSessionReady(!!session);
      setChecking(false);
    }
    establishSession();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("role, onboarded").eq("id", user.id).maybeSingle()
        : { data: null };

      if (profile?.role === "coach") router.replace("/coach");
      else if (profile && !profile.onboarded) router.replace("/onboarding");
      else router.replace("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-diagonal-fade pointer-events-none" />
      <div className="mb-10 relative z-10">
        <JcfWordmark />
      </div>

      <div className="w-full max-w-sm bg-jcf-panel border border-white/10 rounded-sm p-6 relative z-10">
        {checking ? (
          <p className="text-jcf-gray text-sm text-center py-4">Verifying your link...</p>
        ) : !sessionReady ? (
          <>
            <h1 className="font-display uppercase text-lg tracking-wider mb-2">Link Expired</h1>
            <p className="text-jcf-gray text-sm mb-6">
              This link is invalid or has already been used. Request a fresh one from the sign-in screen.
            </p>
            <Button onClick={() => router.replace("/forgot-password")} className="w-full">
              Request New Link
            </Button>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 className="font-display uppercase text-lg tracking-wider mb-1">Set Your Password</h1>
            <p className="text-jcf-gray text-sm mb-6">Choose a password to finish setting up your account.</p>

            <div className="flex flex-col gap-4">
              <Input
                id="password"
                label="New Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Input
                id="confirm"
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-jcf-danger text-sm mt-4">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full mt-6">
              {loading ? "Saving..." : "Set Password & Continue"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
