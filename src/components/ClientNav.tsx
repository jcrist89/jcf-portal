"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { JcfLogo } from "./JcfLogo";

const links = [
  { href: "/dashboard", label: "Home" },
  { href: "/program", label: "Program" },
  { href: "/progress", label: "Progress" },
  { href: "/achievements", label: "Badges" },
  { href: "/messages", label: "Messages" },
  { href: "/settings", label: "Settings" },
];

export function ClientNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

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

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-jcf-charcoal border-t border-white/10 flex justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] uppercase tracking-wider ${
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
