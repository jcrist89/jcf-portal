"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

const TIERS = [
  { id: "free", label: "Free", desc: "Template program, read-only, log your own workouts." },
  { id: "paid_programming", label: "Programming — $10/wk", desc: "Full control of your own program." },
  { id: "paid_coaching", label: "Coaching — $50/wk", desc: "Direct coaching + messaging with Jon." },
] as const;

const GOALS = [
  { id: "strength_gain", label: "Strength Gain", desc: "Lower reps, compound lifts, progressive overload." },
  { id: "fat_loss", label: "Fat Loss", desc: "Moderate reps, higher density, conditioning finishers." },
  { id: "hybrid", label: "Hybrid", desc: "Blend of strength work and conditioning." },
  { id: "powerlifting", label: "Powerlifting", desc: "Squat / bench / deadlift periodization." },
] as const;

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierFromQuery = searchParams.get("tier");

  const [step, setStep] = useState(0);
  const [tier, setTier] = useState<string | null>(
    tierFromQuery && TIERS.some((t) => t.id === tierFromQuery) ? tierFromQuery : null
  );
  const [goal, setGoal] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!tier || !goal) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, goal, fullName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.replace("/onboarding");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />
      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <p className="text-jcf-gray text-xs uppercase tracking-widest mb-8">Step {step + 1} of 3</p>

        <div className="w-full max-w-md bg-jcf-panel border border-white/10 rounded-sm p-6">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-display uppercase tracking-wide text-jcf-gold">Pick Your Plan</h2>
              <div className="flex flex-col gap-2">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    className={`text-left border rounded-sm p-3 transition-colors ${
                      tier === t.id ? "border-jcf-gold bg-jcf-gold/10" : "border-white/15 hover:border-white/30"
                    }`}
                  >
                    <div className="font-display uppercase text-sm tracking-wide">{t.label}</div>
                    <div className="text-jcf-gray text-xs mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
              <Button onClick={() => setStep(1)} disabled={!tier} className="mt-2">
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-display uppercase tracking-wide text-jcf-gold">Pick Your Goal</h2>
              <div className="flex flex-col gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`text-left border rounded-sm p-3 transition-colors ${
                      goal === g.id ? "border-jcf-gold bg-jcf-gold/10" : "border-white/15 hover:border-white/30"
                    }`}
                  >
                    <div className="font-display uppercase text-sm tracking-wide">{g.label}</div>
                    <div className="text-jcf-gray text-xs mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={() => setStep(2)} disabled={!goal} className="flex-1">Continue</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex flex-col gap-4"
            >
              <h2 className="font-display uppercase tracking-wide text-jcf-gold">Create Your Account</h2>
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="text-jcf-danger text-sm">{error}</p>}
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Setting up..." : tier === "free" ? "Finish Setup" : "Continue to Payment"}
                </Button>
              </div>
            </form>
          )}
        </div>

        <p className="text-jcf-gray text-xs mt-8">
          Already have an account?{" "}
          <a href="/login" className="text-jcf-gold hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
