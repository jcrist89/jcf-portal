"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { JcfLogo } from "./JcfLogo";
import { JcfIcon, type JcfIconName } from "./JcfIcon";
import { getBrowserClient } from "@/lib/supabase/browser";

type NavIcon = Extract<JcfIconName, "home" | "train" | "progress" | "coach" | "more">;

const primaryLinks: Array<{ href: string; label: string; icon: NavIcon }> = [
  { href: "/dashboard", label: "Today", icon: "home" },
  { href: "/program", label: "Train", icon: "train" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/messages", label: "Coach", icon: "coach" },
  { href: "/more", label: "More", icon: "more" },
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

  const showUnreadBadge = unreadMessages > 0 && pathname !== "/messages";

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-jcf-black/80 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5">
          <Link href="/dashboard" aria-label="Jon Crist Fit home">
            <JcfLogo size="sm" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Client navigation">
            {primaryLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    active ? "bg-jcf-gold/10 text-jcf-gold" : "text-jcf-gray hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                  {link.href === "/messages" && showUnreadBadge && (
                    <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-jcf-gold" />
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={logout}
            className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-jcf-gray transition-colors hover:text-white md:block"
          >
            Log Out
          </button>
        </div>
      </header>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-white/10 bg-jcf-black/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden"
        aria-label="Client navigation"
      >
        {primaryLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`relative mx-0.5 flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] transition-all ${
                active ? "bg-jcf-gold/10 text-jcf-gold" : "text-jcf-gray"
              }`}
            >
              <span className="relative">
                <span className="block h-5 w-5 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-[1.8] [&>svg]:stroke-linecap-round [&>svg]:stroke-linejoin-round">
                  <JcfIcon name={link.icon} />
                </span>
                {link.href === "/messages" && showUnreadBadge && (
                  <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-jcf-gold" />
                )}
              </span>
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
