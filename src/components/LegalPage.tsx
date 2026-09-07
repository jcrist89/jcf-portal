import Link from "next/link";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="px-4 py-10 max-w-2xl mx-auto">
      <Link href="/" className="text-jcf-gold text-xs uppercase tracking-widest hover:underline">← Jon Crist Fit</Link>
      <h1 className="font-display text-3xl uppercase tracking-wide mt-5 mb-6">{title}</h1>
      <div className="space-y-5 text-sm leading-relaxed text-jcf-gray">{children}</div>
    </main>
  );
}
