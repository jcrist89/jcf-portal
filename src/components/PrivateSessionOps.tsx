"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type RequestRow = {
  id: string;
  customer_email: string;
  preferred_days: string;
  preferred_time: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export function PrivateSessionOps({ initialRequests }: { initialRequests: RequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(id: string, status: "scheduled" | "completed" | "canceled") {
    setBusy(id + status);
    setError(null);
    try {
      const res = await fetch("/api/coach/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, status }),
      });
      if (!res.ok) throw new Error("Could not update the session request.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the session request.");
    } finally {
      setBusy(null);
    }
  }

  if (initialRequests.length === 0) {
    return (
      <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 text-jcf-gray text-sm">
        No private sessions are waiting on you.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-jcf-danger text-sm">{error}</p>}
      {initialRequests.map((row) => (
        <div key={row.id} className="bg-jcf-panel border border-white/10 rounded-sm p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium">{row.customer_email}</div>
              <div className="text-jcf-gray text-xs mt-1">
                {row.preferred_days} · {row.preferred_time}
              </div>
              {row.notes && <p className="text-jcf-gray text-sm mt-2">{row.notes}</p>}
            </div>
            <span className={row.status === "scheduled" ? "text-jcf-success text-xs uppercase tracking-widest" : "text-jcf-gold text-xs uppercase tracking-widest"}>
              {row.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {row.status === "requested" && (
              <button
                type="button"
                disabled={busy != null}
                onClick={() => updateStatus(row.id, "scheduled")}
                className="text-xs uppercase tracking-widest px-3 py-2 rounded-sm bg-[#2563eb] text-white disabled:opacity-50"
              >
                Mark Scheduled
              </button>
            )}
            {row.status === "scheduled" && (
              <button
                type="button"
                disabled={busy != null}
                onClick={() => updateStatus(row.id, "completed")}
                className="text-xs uppercase tracking-widest px-3 py-2 rounded-sm bg-jcf-success text-black disabled:opacity-50"
              >
                Mark Completed
              </button>
            )}
            <button
              type="button"
              disabled={busy != null}
              onClick={() => updateStatus(row.id, "canceled")}
              className="text-xs uppercase tracking-widest px-3 py-2 rounded-sm border border-white/15 text-jcf-gray disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
