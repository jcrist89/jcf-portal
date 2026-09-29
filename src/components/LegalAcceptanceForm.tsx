"use client";

import { useState } from "react";

type Document = {
  id: string;
  title: string;
  version: string;
  urlPath: string;
};

export function LegalAcceptanceForm({
  offer,
  documents,
}: {
  offer: string;
  documents: Document[];
}) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAccepted = documents.length > 0 && documents.every((doc) => accepted[doc.id]);

  async function continueToCheckout() {
    if (!allAccepted) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer,
          documentIds: documents.map((doc) => doc.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record acceptance.");
      window.location.assign(`/go/${encodeURIComponent(offer)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record acceptance.");
      setBusy(false);
    }
  }

  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-6">
      <div className="flex flex-col gap-4">
        {documents.map((doc) => (
          <label key={doc.id} className="flex gap-3 items-start border border-white/10 rounded-sm p-4">
            <input
              type="checkbox"
              checked={accepted[doc.id] ?? false}
              onChange={(e) => setAccepted((prev) => ({ ...prev, [doc.id]: e.target.checked }))}
              className="mt-1"
            />
            <span>
              <span className="block text-sm text-white">
                I have read and agree to the{" "}
                <a
                  href={doc.urlPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-jcf-gold hover:underline"
                >
                  {doc.title}
                </a>
                .
              </span>
              <span className="block text-jcf-gray text-xs mt-1">Version {doc.version}</span>
            </span>
          </label>
        ))}
      </div>

      {error && <p className="text-jcf-danger text-sm mt-4">{error}</p>}

      <button
        type="button"
        disabled={!allAccepted || busy}
        onClick={continueToCheckout}
        className="mt-5 w-full bg-[#f97316] text-black uppercase tracking-widest text-xs font-bold px-4 py-3 rounded-sm disabled:opacity-40"
      >
        {busy ? "Recording…" : "Agree & continue to checkout"}
      </button>

      <p className="text-jcf-gray text-xs mt-4">
        The accepted document version and timestamp are recorded with the purchase workflow.
      </p>
    </div>
  );
}
