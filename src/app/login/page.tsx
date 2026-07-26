"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { JcfWordmark } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.replace(data.role === "coach" ? "/coach" : "/dashboard");
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
        <h1 className="font-display uppercase text-lg tracking-wider mb-1">Sign In</h1>
        <p className="text-jcf-gray text-sm mb-6">Enter your email and password.</p>

        <div className="flex flex-col gap-4">
          <Input
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex justify-end mt-2">
          <Link href="/forgot-password" className="text-jcf-gray text-xs hover:text-jcf-gold">
            Forgot password?
          </Link>
        </div>

        {error && <p className="text-jcf-danger text-sm mt-4">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full mt-6">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="text-jcf-gray text-xs mt-8 relative z-10">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-jcf-gold hover:underline">
          Get started
        </Link>
      </p>
    </div>
  );
}
