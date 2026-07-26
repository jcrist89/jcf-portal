"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { JcfWordmark } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-jcf-panel border border-white/10 rounded-sm p-6 relative z-10"
      >
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
    </div>
  );
}
