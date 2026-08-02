"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { JcfLogo } from "./JcfLogo";
import { getBrowserClient } from "@/lib/supabase/browser";

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/program", label: "Program" },
  { href: "/progress", label: "Progress" },
  { href: "/achievements", label: "Badges" },
  { href: "/messages", label: "Messages" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

export function ClientNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  useEffect(() => {
    let cancelled = false;
    const supabase = getBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUnreadMessages(data.unreadCount ?? 0);
      })
      .catch(() => {});

    async function setup() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`client-nav-notes-${session.user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "coach_notes", filter: `profile_id=eq.${session.user.id}` },
          (payload: any) => {
            if (payload.new?.author === "coach") setUnreadMessages((prev) => prev + 1);
          }
        )
        .subscribe();
    }

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Already looking at the thread — don't badge the tab you're standing on.
  const showUnreadBadge = unreadMessages > 0 && pathname !== "/messages";

  return (
    <>
      <header className="sticky top-0 z-20 bg-jcf-black/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard">
          <JcfLogo size="sm" />
        </Link>
        <button
          onClick={logout}
          className="text-[11px] uppercase tracking-widest text-jcf-gray hover:text-jcf-gold"
        >
          Log Out
        </button>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-jcf-charcoal border-t border-white/10 overflow-x-auto jcf-scrollbar flex justify-start sm:justify-around gap-1 px-1 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`relative shrink-0 flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] uppercase tracking-wider ${
                active ? "text-jcf-gold" : "text-jcf-gray"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-jcf-gold" : "bg-transparent"}`} />
              {l.label}
              {l.href === "/messages" && showUnreadBadge && (
                <span className="absolute top-0 right-1.5 w-1.5 h-1.5 rounded-full bg-jcf-danger" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
