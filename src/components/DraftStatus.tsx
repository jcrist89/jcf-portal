import type { DraftSyncStatus } from "@/lib/hooks/useDraftSync";

const LABELS: Record<DraftSyncStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved on this device",
  synced: "Synced",
  offline: "Saved on this device · offline",
};

export function DraftStatus({ status }: { status: DraftSyncStatus }) {
  if (!LABELS[status]) return null;
  return (
    <p className="text-[10px] uppercase tracking-widest text-jcf-gray flex items-center gap-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "synced"
            ? "bg-jcf-success"
            : status === "offline"
            ? "bg-jcf-danger"
            : "bg-jcf-gold animate-pulse"
        }`}
      />
      {LABELS[status]}
    </p>
  );
}
