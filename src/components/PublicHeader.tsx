import Link from "next/link";
import { JcfLogo } from "./JcfLogo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-jcf-black/80 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Link href="/" aria-label="Jon Crist Fit home"><JcfLogo size="sm" /></Link><nav className="flex items-center gap-2 sm:gap-3">
        <Link href="/pricing" className="rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-jcf-gray transition-colors hover:bg-white/5 hover:text-white">
          Coaching
        </Link>
        <Link href="/login" className="rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-jcf-gray transition-colors hover:bg-white/5 hover:text-white">
          Sign In
        </Link>
        <Link
          href="/pricing"
          className="rounded-xl bg-jcf-gold px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-jcf-black transition-all hover:brightness-105 active:translate-y-px"
        >
          Get Started
        </Link>
      </nav></div>
    </header>
  );
}
