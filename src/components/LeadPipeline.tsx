"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Lead = {
  id: string;
  cohort_week: string;
  full_name: string | null;
  email: string | null;
  contact_handle: string | null;
  source: string;
  medium: string | null;
  campaign: string | null;
  content_id: string | null;
  inquiry_interest: string | null;
  goal: string | null;
  schedule_context: string | null;
  status: string;
  offer_code: string | null;
  contracted_value_cents: number | null;
  next_action: string | null;
  next_action_due: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_at: string;
};

type Offer = { code: string; name: string };

export function LeadPipeline({ initialLeads, offers }: { initialLeads: Lead[]; offers: Offer[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    contactHandle: "",
    source: "instagram",
    medium: "dm",
    campaign: "",
    contentId: "",
    inquiryInterest: "",
    goal: "",
    nextAction: "Reply / qualify",
    nextActionDue: new Date().toISOString().slice(0, 10),
  });

  async function createLead() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create lead.");
      setForm({
        fullName: "",
        email: "",
        contactHandle: "",
        source: "instagram",
        medium: "dm",
        campaign: "",
        contentId: "",
        inquiryInterest: "",
        goal: "",
        nextAction: "Reply / qualify",
        nextActionDue: new Date().toISOString().slice(0, 10),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lead.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <section className="bg-jcf-panel/80 border border-white/10 rounded-[22px] p-5 mb-6 shadow-[0_16px_45px_rgba(0,0,0,0.16)]">
        <h2 className="font-display uppercase tracking-wide mb-3">Log A Lead</h2>
        {error && <p className="text-jcf-danger text-sm mb-3">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="IG / Contact Handle" value={form.contactHandle} onChange={(v) => setForm({ ...form, contactHandle: v })} />
          <Field label="Interest" value={form.inquiryInterest} onChange={(v) => setForm({ ...form, inquiryInterest: v })} placeholder="local, remote, 3-pay, unsure" />
          <Field label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
          <Field label="Medium" value={form.medium} onChange={(v) => setForm({ ...form, medium: v })} />
          <Field label="Campaign" value={form.campaign} onChange={(v) => setForm({ ...form, campaign: v })} placeholder="oct_2026_launch" />
          <Field label="Content ID" value={form.contentId} onChange={(v) => setForm({ ...form, contentId: v })} placeholder="reel_014" />
          <label className="sm:col-span-2 text-xs text-jcf-gray">
            <span className="block uppercase tracking-widest mb-1">Goal / problem</span>
            <textarea
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="w-full min-h-20 bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
            />
          </label>
          <Field label="Next action" value={form.nextAction} onChange={(v) => setForm({ ...form, nextAction: v })} />
          <label className="text-xs text-jcf-gray">
            <span className="block uppercase tracking-widest mb-1">Due</span>
            <input
              type="date"
              value={form.nextActionDue}
              onChange={(e) => setForm({ ...form, nextActionDue: e.target.value })}
              className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={createLead}
          disabled={creating}
          className="mt-4 bg-[#FF6B1A] text-black uppercase tracking-widest text-xs font-bold px-4 py-3 rounded-xl disabled:opacity-50"
        >
          {creating ? "Saving…" : "Add lead"}
        </button>
      </section>

      <div className="flex flex-col gap-3">
        {initialLeads.length === 0 ? (
          <div className="bg-jcf-panel/80 border border-white/10 rounded-[20px] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.14)] text-jcf-gray text-sm">
            No leads logged yet.
          </div>
        ) : (
          initialLeads.map((lead) => <LeadCard key={lead.id} lead={lead} offers={offers} />)
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, offers }: { lead: Lead; offers: Offer[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [offerCode, setOfferCode] = useState(lead.offer_code ?? "");
  const [nextAction, setNextAction] = useState(lead.next_action ?? "");
  const [nextActionDue, setNextActionDue] = useState(lead.next_action_due ?? "");
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update lead.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update lead.");
    } finally {
      setBusy(false);
    }
  }

  async function markLost() {
    const reason = window.prompt("Why was this lead lost?");
    if (!reason?.trim()) return;
    await patch({ status: "lost", lostReason: reason.trim() });
  }

  return (
    <article className="bg-jcf-panel border border-white/10 rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">{lead.full_name || lead.contact_handle || lead.email || "Unnamed lead"}</div>
          <div className="text-jcf-gray text-xs mt-1">
            {[lead.contact_handle, lead.email].filter(Boolean).join(" · ")}
          </div>
          <div className="text-jcf-gray text-xs mt-1">
            Cohort {lead.cohort_week} · {lead.source}{lead.medium ? ` / ${lead.medium}` : ""}
            {lead.campaign ? ` · ${lead.campaign}` : ""}
            {lead.content_id ? ` · ${lead.content_id}` : ""}
          </div>
        </div>
        <span className="text-xs uppercase tracking-widest text-[#FF6B1A]">{lead.status}</span>
      </div>

      {lead.goal && <p className="text-sm text-white mt-3">{lead.goal}</p>}
      {lead.inquiry_interest && <p className="text-jcf-gray text-xs mt-2">Interest: {lead.inquiry_interest}</p>}
      {lead.lost_reason && <p className="text-jcf-danger text-xs mt-2">Lost: {lead.lost_reason}</p>}
      {lead.contracted_value_cents != null && (
        <p className="text-jcf-success text-xs mt-2">
          Contracted: {(lead.contracted_value_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </p>
      )}

      {error && <p className="text-jcf-danger text-sm mt-3">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-[1fr_150px_auto] mt-4">
        <input
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="Next action"
          className="bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={nextActionDue}
          onChange={(e) => setNextActionDue(e.target.value)}
          className="bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => patch({ nextAction, nextActionDue })}
          className="border border-white/15 rounded-xl px-3 py-2 text-xs uppercase tracking-widest text-jcf-gray disabled:opacity-50"
        >
          Save task
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[220px_1fr] mt-3">
        <select
          value={offerCode}
          onChange={(e) => setOfferCode(e.target.value)}
          className="bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
        >
          <option value="">Select offer for win…</option>
          {offers.map((offer) => (
            <option key={offer.code} value={offer.code}>{offer.name}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {lead.status === "new" && <Action disabled={busy} onClick={() => patch({ status: "qualified" })}>Qualified</Action>}
          {["new","qualified","nurture"].includes(lead.status) && <Action disabled={busy} onClick={() => patch({ status: "booked" })}>Booked</Action>}
          {["booked","qualified"].includes(lead.status) && <Action disabled={busy} onClick={() => patch({ status: "attended" })}>Attended</Action>}
          {!["won","lost"].includes(lead.status) && (
            <Action disabled={busy || !offerCode} onClick={() => patch({ status: "won", offerCode })}>Won</Action>
          )}
          {!["won","lost"].includes(lead.status) && <Action disabled={busy} onClick={() => patch({ status: "nurture" })}>Nurture</Action>}
          {lead.status !== "lost" && <Action disabled={busy} onClick={markLost}>Lost</Action>}
        </div>
      </div>
    </article>
  );
}

function Action({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border border-jcf-blue/50 text-jcf-blue hover:bg-jcf-blue/10 rounded-xl px-3 py-2 text-xs uppercase tracking-widest disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-xs text-jcf-gray">
      <span className="block uppercase tracking-widest mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
      />
    </label>
  );
}
