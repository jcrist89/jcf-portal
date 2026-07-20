"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { JcfWordmark } from "@/components/JcfLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
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
        body: JSON.stringify({ username, pin }),
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
        <p className="text-jcf-gray text-sm mb-6">Enter the username and PIN Jon gave you.</p>

        <div className="flex flex-col gap-4">
          <Input
            id="username"
            label="Username"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            id="pin"
            label="PIN"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>

        {error && <p className="text-jcf-danger text-sm mt-4">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full mt-6">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="text-jcf-gray text-xs mt-8 relative z-10">
        Don&apos;t have a login? Ask Jon to set up your account.
      </p>
    </div>
  );
}
