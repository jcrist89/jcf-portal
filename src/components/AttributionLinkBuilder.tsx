"use client";

import { useMemo, useState } from "react";

const OFFERS = [
  { value: "local-pif", label: "Local Coaching — $399 PIF" },
  { value: "local-3pay", label: "Local Coaching — 3 × $150" },
  { value: "remote-pif", label: "Remote Coaching — $997 PIF" },
  { value: "private", label: "Private Training — $45" },
  { value: "reset", label: "Shift Reset — $27" },
  { value: "inquiry", label: "Coaching Inquiry Form" },
] as const;

export function AttributionLinkBuilder() {
  const [offer, setOffer] = useState("local-pif");
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("dm");
  const [campaign, setCampaign] = useState("oct_2026_launch");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (source.trim()) params.set("utm_source", source.trim());
    if (medium.trim()) params.set("utm_medium", medium.trim());
    if (campaign.trim()) params.set("utm_campaign", campaign.trim());
    if (content.trim()) params.set("utm_content", content.trim());
    const base = offer === "inquiry" ? "/start" : `/go/${offer}`;
    return `${base}?${params.toString()}`;
  }, [offer, source, medium, campaign, content]);

  async function copy() {
    const full = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-jcf-panel/80 border border-white/10 rounded-[20px] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.14)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-jcf-gray">
          <span className="block uppercase tracking-widest mb-1">Offer</span>
          <select
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
          >
            {OFFERS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-jcf-gray">
          <span className="block uppercase tracking-widest mb-1">Source</span>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="instagram"
            className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
          />
        </label>
        <label className="text-xs text-jcf-gray">
          <span className="block uppercase tracking-widest mb-1">Medium</span>
          <input
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="dm, bio, organic"
            className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
          />
        </label>
        <label className="text-xs text-jcf-gray">
          <span className="block uppercase tracking-widest mb-1">Campaign</span>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="oct_2026_launch"
            className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
          />
        </label>
        <label className="text-xs text-jcf-gray sm:col-span-2">
          <span className="block uppercase tracking-widest mb-1">Content ID</span>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="reel_014, menu_monday_03, story_reset_01"
            className="w-full bg-jcf-black/40 border border-white/15 rounded-xl px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="mt-4 bg-jcf-black/45 border border-white/10 rounded-xl p-3 font-mono text-xs text-jcf-gray break-all">
        {path}
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 bg-[#FF6B1A] text-black uppercase tracking-widest text-xs font-bold px-4 py-3 rounded-xl"
      >
        {copied ? "Copied" : "Copy tracked link"}
      </button>
      <p className="text-jcf-gray text-xs mt-3">
        Use a unique Content ID for each Reel, carousel, Story sequence, or DM campaign you want to measure.
      </p>
    </div>
  );
}
