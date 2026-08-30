"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { JcfWordmark } from "./JcfLogo";

const links = [
  { href: "/coach", label: "Who Needs Me" },
  { href: "/coach/clients", label: "All Clients" },
  { href: "/coach/templates", label: "Templates" },
  { href: "/coach/monitoring", label: "Monitoring" },
  { href: "/coach/my-program", label: "My Training" },
  { href: "/settings", label: "Settings" },
];

export function CoachNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-jcf-black/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/coach">
            <JcfWordmark />
          </Link>
          <nav className="hidden sm:flex gap-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-xs uppercase tracking-widest ${
                  pathname === l.href ? "text-jcf-gold" : "text-jcf-gray hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <button onClick={logout} className="text-[11px] uppercase tracking-widest text-jcf-gray hover:text-jcf-gold">
          Log Out
        </button>
      </header>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-jcf-charcoal border-t border-white/10 overflow-x-auto jcf-scrollbar flex justify-start gap-1 px-1 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] uppercase tracking-wider ${
                active ? "text-jcf-gold" : "text-jcf-gray"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-jcf-gold" : "bg-transparent"}`} />
              {l.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
