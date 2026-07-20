"use client";
import { useState } from "react";
import type { CoachNote } from "@/lib/types";
import { Button } from "@/components/Button";

export function MessageThread({
  initialNotes,
  profileId,
  viewerRole,
}: {
  initialNotes: CoachNote[];
  profileId: string;
  viewerRole: "coach" | "client";
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, message }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotes((prev) => [...prev, data.note]);
        setMessage("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto jcf-scrollbar flex flex-col gap-3 pb-4">
        {notes.length === 0 && (
          <p className="text-jcf-gray text-sm">
            {viewerRole === "client" ? "No messages yet — Jon will check in here." : "No messages yet."}
          </p>
        )}
        {notes.map((n) => {
          const isSelf = n.author === viewerRole;
          return (
            <div key={n.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-sm px-3 py-2 text-sm ${
                  isSelf ? "bg-jcf-gold text-jcf-black" : "bg-jcf-panel border border-white/10 text-white"
                }`}
              >
                <div>{n.message}</div>
                <div className={`text-[10px] mt-1 ${isSelf ? "text-jcf-black/60" : "text-jcf-gray"}`}>
                  {n.author === "coach" ? "Jon" : "You"} · {new Date(n.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sticky bottom-0 bg-jcf-black">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Write a message..."
          className="flex-1 bg-jcf-panel border border-white/15 rounded-sm px-3 py-2.5 text-sm text-white focus:outline-none focus:border-jcf-gold"
        />
        <Button onClick={send} disabled={sending || !message.trim()}>Send</Button>
      </div>
    </div>
  );
}
