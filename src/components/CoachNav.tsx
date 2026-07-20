"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { JcfWordmark } from "./JcfLogo";

const links = [
  { href: "/coach", label: "All Clients" },
  { href: "/coach/templates", label: "Templates" },
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
  );
}
