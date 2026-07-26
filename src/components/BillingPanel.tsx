"use client";
import { useState } from "react";
import { Button } from "@/components/Button";

export function BillingPanel({ hasStripeCustomer }: { hasStripeCustomer: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open billing portal.");
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  if (!hasStripeCustomer) return null;

  return (
    <div>
      <Button onClick={openPortal} disabled={loading}>
        {loading ? "Opening..." : "Manage Billing"}
      </Button>
      {error && <p className="text-jcf-danger text-sm mt-2">{error}</p>}
    </div>
  );
}
