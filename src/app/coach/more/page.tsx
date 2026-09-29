import Link from "next/link";
import { CoachNav } from "@/components/CoachNav";
import { requireUser } from "@/lib/auth/require";
import { SignOutButton } from "@/components/SignOutButton";

const tools = [
  { href: "/coach/operations", eyebrow: "Business", title: "Operations", copy: "Launch readiness, billing signals, and the systems that keep coaching moving." },
  { href: "/coach/acquisition", eyebrow: "Growth", title: "Acquisition", copy: "Review acquisition performance and where clients are coming from." },
  { href: "/coach/templates", eyebrow: "Programming", title: "Templates", copy: "Build and manage reusable program templates." },
  { href: "/coach/monitoring", eyebrow: "Health", title: "Monitoring", copy: "See platform monitoring and operational signals." },
  { href: "/coach/my-program", eyebrow: "Coach", title: "My Training", copy: "Open your own training program without mixing it into client work." },
  { href: "/settings", eyebrow: "Account", title: "Settings", copy: "Manage account and application preferences." },
];

export default async function CoachMorePage() {
  await requireUser("coach");

  return (
    <div className="pb-24">
      <CoachNav />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-4xl px-4 pt-6">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-jcf-gray">Coach tools</p>
        <h1 className="font-display text-4xl uppercase leading-none tracking-wide">More</h1>
        <p className="mb-7 mt-2 max-w-xl text-sm leading-relaxed text-jcf-gray">
          Secondary tools live here so the daily coaching workflow stays clean.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-[20px] border border-white/10 bg-jcf-panel/80 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-jcf-blue/30"
            >
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-jcf-blue">{tool.eyebrow}</p>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl uppercase tracking-wide text-white">{tool.title}</h2>
                <span className="text-jcf-gray transition-transform group-hover:translate-x-0.5">→</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-jcf-gray">{tool.copy}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6 md:hidden"><SignOutButton /></div>
      </main>
    </div>
  );
}
