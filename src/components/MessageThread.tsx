"use client";
import { useEffect, useRef, useState } from "react";
import type { CoachNote } from "@/lib/types";
import { Button } from "@/components/Button";
import { getBrowserClient } from "@/lib/supabase/browser";

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
  const noteIds = useRef(new Set(initialNotes.map((n) => n.id)));

  function markRead() {
    fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    }).catch(() => {});
  }

  // Opening a thread marks whatever the other party already sent as read.
  useEffect(() => {
    markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setup() {
      // Postgres Changes RLS is evaluated using whatever JWT is currently attached
      // to the realtime socket. supabase-js attaches it asynchronously as auth state
      // resolves, which can lose the race against .subscribe() — so set it explicitly
      // before subscribing rather than relying on that timing.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`coach-notes-${profileId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "coach_notes", filter: `profile_id=eq.${profileId}` },
          (payload: any) => {
            const note = payload.new as CoachNote;
            if (noteIds.current.has(note.id)) return;
            noteIds.current.add(note.id);
            setNotes((prev) => [...prev, note]);
            // The thread is open right now, so a message from the other party
            // arriving live counts as read immediately.
            if (note.author !== viewerRole) markRead();
          }
        )
        .subscribe();
    }

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // markRead isn't memoized (a new reference every render) and viewerRole is a
    // stable prop for the life of a mounted thread — including either would just
    // tear down and re-subscribe the Realtime channel on every render, which is
    // worse than the (correct) staleness this rule is warning about. Same
    // rationale as the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

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
        noteIds.current.add(data.note.id);
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
