import Link from "next/link";
import { JcfLogo } from "./JcfLogo";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 bg-jcf-black/95 backdrop-blur border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between">
      <Link href="/">
        <JcfLogo size="sm" />
      </Link>
      <nav className="flex items-center gap-4 sm:gap-6">
        <Link href="/pricing" className="text-xs uppercase tracking-widest text-jcf-gray hover:text-white">
          Pricing
        </Link>
        <Link href="/login" className="text-xs uppercase tracking-widest text-jcf-gray hover:text-white">
          Sign In
        </Link>
        <Link
          href="/signup"
          className="text-xs uppercase tracking-widest bg-jcf-gold text-jcf-black font-semibold px-3 py-2 rounded-sm hover:bg-jcf-goldLight"
        >
          Get Started
        </Link>
      </nav>
    </header>
  );
}
