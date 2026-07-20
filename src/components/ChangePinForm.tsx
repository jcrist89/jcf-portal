"use client";
import { useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function ChangePinForm() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? "Something went wrong." });
        return;
      }
      setMessage({ ok: true, text: "PIN updated." });
      setCurrentPin("");
      setNewPin("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-jcf-panel border border-white/10 rounded-sm p-4 flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-1">Change PIN</h3>
      <Input
        label="Current PIN"
        type="password"
        inputMode="numeric"
        value={currentPin}
        onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
        required
      />
      <Input
        label="New PIN (4-6 digits)"
        type="password"
        inputMode="numeric"
        value={newPin}
        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
        required
      />
      {message && (
        <p className={`text-sm ${message.ok ? "text-jcf-success" : "text-jcf-danger"}`}>{message.text}</p>
      )}
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update PIN"}</Button>
    </form>
  );
}
