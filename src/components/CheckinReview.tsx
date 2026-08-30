"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import type { TrendedField } from "@/domain/checkin";

export interface ReviewItem {
  checkinId: string;
  profileId: string;
  name: string;
  dueOn: string;
  submittedAt: string | null;
  hoursWaiting: number | null;
  fields: TrendedField[];
  win: string | null;
  struggle: string | null;
  ask: string | null;
}

/**
 * One check-in, reviewed.
 *
 * This week beside last week, with the changes worth eight minutes marked. Handing a
 * coach twenty numbers and expecting them to spot the two that moved is how eight
 * minutes becomes twenty, and why review queues get abandoned.
 *
 * The response goes to the message thread as well as the record, so the client reads it
 * where they already look rather than in a form they filled in days ago.
 */
export function CheckinReview({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!response.trim()) {
      setError("Write something back — marking it read isn't the point.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/checkins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId: item.checkinId, response }),
      });
      if (!res.ok) throw new Error("failed");
      setResponse("");
      router.refresh();
    } catch {
      setError("Didn't send. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const waitingLabel =
    item.hoursWaiting != null && item.hoursWaiting >= 24
      ? `waiting ${Math.floor(item.hoursWaiting / 24)}d`
      : "just in";

  return (
    <article className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="font-display uppercase tracking-wide text-white">{item.name}</h2>
        <span className="text-xs text-jcf-gray shrink-0">{waitingLabel}</span>
      </div>
      <p className="text-jcf-gray text-xs mb-3">Week of {item.dueOn}</p>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-jcf-gray text-[10px] uppercase tracking-wider">
              <th className="text-left font-normal py-1">Measure</th>
              <th className="text-right font-normal py-1">This week</th>
              <th className="text-right font-normal py-1">Last</th>
              <th className="text-right font-normal py-1">Change</th>
            </tr>
          </thead>
          <tbody>
            {item.fields
              .filter((f) => f.current != null || f.previous != null)
              .map((f) => (
                <tr key={f.key} className={f.notable ? "text-jcf-gold" : "text-white"}>
                  <td className="py-1 text-jcf-gray">{f.label}</td>
                  <td className="py-1 text-right tabular-nums">{f.current ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums text-jcf-gray">{f.previous ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums">
                    {f.delta == null ? "—" : f.delta > 0 ? `+${f.delta}` : f.delta}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {[
        { label: "Win", value: item.win },
        { label: "Struggle", value: item.struggle },
        { label: "Asked about", value: item.ask },
      ]
        .filter((x) => x.value)
        .map((x) => (
          <div key={x.label} className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-jcf-gray mb-0.5">{x.label}</p>
            <p className="text-white text-sm whitespace-pre-wrap">{x.value}</p>
          </div>
        ))}

      <textarea
        rows={3}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write back…"
        aria-label={`Response to ${item.name}`}
        className="w-full bg-jcf-charcoal border border-white/15 rounded-sm px-3 py-2 text-white focus:border-jcf-gold outline-none resize-y mb-2"
      />
      {error && (
        <p role="alert" className="text-jcf-danger text-xs mb-2">
          {error}
        </p>
      )}
      <Button onClick={send} disabled={saving} className="w-full">
        {saving ? "Sending…" : "Send response"}
      </Button>
    </article>
  );
}
