"use client";
import { useState } from "react";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { getBrowserClient } from "@/lib/supabase/browser";

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      if (newPassword.length < 8) {
        setMessage({ ok: false, text: "Password must be at least 8 characters." });
        return;
      }
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage({ ok: false, text: error.message });
        return;
      }
      setMessage({ ok: true, text: "Password updated." });
      setNewPassword("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-jcf-panel border border-white/10 rounded-sm p-4 flex flex-col gap-3">
      <h3 className="text-xs uppercase tracking-widest text-jcf-gold mb-1">Change Password</h3>
      <Input
        label="New Password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
      />
      {message && (
        <p className={`text-sm ${message.ok ? "text-jcf-success" : "text-jcf-danger"}`}>{message.text}</p>
      )}
      <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update Password"}</Button>
    </form>
  );
}
