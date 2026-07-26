"use client";
import { useState } from "react";
import { JcfWordmark } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { getBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
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
        {sent ? (
          <>
            <h1 className="font-display uppercase text-lg tracking-wider mb-2">Check Your Email</h1>
            <p className="text-jcf-gray text-sm">
              If an account exists for {email}, a password reset link is on its way.
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 className="font-display uppercase text-lg tracking-wider mb-1">Reset Password</h1>
            <p className="text-jcf-gray text-sm mb-6">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-jcf-danger text-sm mt-4">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full mt-6">
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        )}
      </div>

      <Link href="/login" className="text-jcf-gray text-xs mt-8 relative z-10 hover:text-jcf-gold">
        Back to sign in
      </Link>
    </div>
  );
}
