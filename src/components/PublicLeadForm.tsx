"use client";

import { useState, type FormEvent } from "react";

export function PublicLeadForm({ initialInterest = "" }: { initialInterest?: string }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    contactHandle: "",
    inquiryInterest: initialInterest,
    goal: "",
    scheduleContext: "",
    website: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send inquiry.");
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Could not send inquiry.");
    }
  }

  if (state === "sent") {
    return (
      <div className="bg-jcf-panel border border-jcf-success/30 rounded-sm p-6">
        <p className="text-jcf-success text-xs uppercase tracking-widest mb-2">Inquiry received</p>
        <h2 className="font-display uppercase text-2xl mb-2">You&apos;re in the queue.</h2>
        <p className="text-jcf-gray text-sm leading-relaxed">
          Jon has your goal and contact information. The next step is a short conversation to make sure the coaching option actually fits what you need.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-jcf-panel border border-white/10 rounded-sm p-6 grid gap-4">
      {error && <p className="text-jcf-danger text-sm">{error}</p>}

      <label className="text-xs text-jcf-gray">
        <span className="block uppercase tracking-widest mb-1">Name</span>
        <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full bg-jcf-black border border-white/15 rounded-sm px-3 py-3 text-white" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-jcf-gray">
          <span className="block uppercase tracking-widest mb-1">Email</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-jcf-black border border-white/15 rounded-sm px-3 py-3 text-white" />
        </label>
        <label className="text-xs text-jcf-gray">
          <span className="block uppercase tracking-widest mb-1">Instagram handle</span>
          <input value={form.contactHandle} onChange={(e) => setForm({ ...form, contactHandle: e.target.value })} placeholder="@username" className="w-full bg-jcf-black border border-white/15 rounded-sm px-3 py-3 text-white" />
        </label>
      </div>

      <label className="text-xs text-jcf-gray">
        <span className="block uppercase tracking-widest mb-1">What are you interested in?</span>
        <select value={form.inquiryInterest} onChange={(e) => setForm({ ...form, inquiryInterest: e.target.value })} className="w-full bg-jcf-black border border-white/15 rounded-sm px-3 py-3 text-white">
          <option value="">Not sure yet</option>
          <option value="local">Local 12-week coaching</option>
          <option value="local-3pay">Local coaching — 3-payment option</option>
          <option value="remote">Remote 12-week coaching</option>
          <option value="private">Private training</option>
        </select>
      </label>

      <label className="text-xs text-jcf-gray">
        <span className="block uppercase tracking-widest mb-1">What do you want help with?</span>
        <textarea required value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="Fat loss, getting consistent again, strength, knowing what to do in the gym…" className="w-full min-h-28 bg-jcf-black border border-white/15 rounded-sm px-3 py-3 text-white" />
      </label>

      <label className="text-xs text-jcf-gray">
        <span className="block uppercase tracking-widest mb-1">What makes your schedule difficult?</span>
        <textarea value={form.scheduleContext} onChange={(e) => setForm({ ...form, scheduleContext: e.target.value })} placeholder="Night shift, kids, changing schedule, travel, limited gym time…" className="w-full min-h-20 bg-jcf-black border border-white/15 rounded-sm px-3 py-3 text-white" />
      </label>

      <div className="hidden" aria-hidden="true">
        <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
      </div>

      <button type="submit" disabled={state === "sending"} className="bg-[#f97316] text-black uppercase tracking-widest text-xs font-bold px-4 py-3 rounded-sm disabled:opacity-50">
        {state === "sending" ? "Sending…" : "Send coaching inquiry"}
      </button>
      <p className="text-jcf-gray text-xs">
        This is a coaching inquiry, not a medical form. Do not submit urgent health information here.
      </p>
    </form>
  );
}
