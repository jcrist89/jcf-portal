"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { JcfWordmark } from "./JcfLogo";
import { JcfIcon, type JcfIconName } from "./JcfIcon";

type NavIcon = Extract<JcfIconName, "home" | "clients" | "checkin" | "leads" | "more">;

const links: Array<{ href: string; label: string; icon: NavIcon }> = [
  { href: "/coach", label: "Today", icon: "home" },
  { href: "/coach/clients", label: "Clients", icon: "clients" },
  { href: "/coach/checkins", label: "Check-Ins", icon: "checkin" },
  { href: "/coach/leads", label: "Leads", icon: "leads" },
  { href: "/coach/more", label: "More", icon: "more" },
];

export function CoachNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  function active(href: string) {
    return pathname === href || (href !== "/coach" && pathname.startsWith(`${href}/`));
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-jcf-black/80 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Link href="/coach">
            <JcfWordmark />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Coach navigation">
            {links.map((link) => {
              const isActive = active(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    isActive ? "bg-jcf-gold/10 text-jcf-gold" : "text-jcf-gray hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <button onClick={logout} className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-jcf-gray hover:text-white md:block">
            Log Out
          </button>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-white/10 bg-jcf-black/90 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Coach navigation">
        {links.map((link) => {
          const isActive = active(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`mx-0.5 flex min-w-0 flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                isActive ? "bg-jcf-gold/10 text-jcf-gold" : "text-jcf-gray"
              }`}
            >
              <span className="block h-5 w-5 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:fill-none [&>svg]:stroke-current [&>svg]:stroke-[1.8] [&>svg]:stroke-linecap-round [&>svg]:stroke-linejoin-round">
                <JcfIcon name={link.icon} />
              </span>
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
