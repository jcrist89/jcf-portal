import Link from "next/link";
import { ClientNav } from "@/components/ClientNav";
import { requireUser } from "@/lib/auth/require";
import { SignOutButton } from "@/components/SignOutButton";

const items = [
  { href: "/nutrition", eyebrow: "Fuel", title: "Nutrition", copy: "Log food, save repeatable meals, and keep your targets visible." },
  { href: "/checkin", eyebrow: "Review", title: "Check-In", copy: "Send the numbers and context Jon needs to adjust the plan." },
  { href: "/achievements", eyebrow: "Proof", title: "Achievements", copy: "See the milestones you have earned instead of relying on memory." },
  { href: "/billing", eyebrow: "Account", title: "Billing", copy: "View your coaching billing and subscription details." },
  { href: "/settings", eyebrow: "Account", title: "Settings", copy: "Update your profile, preferences, and app settings." },
];

export default async function MorePage() {
  await requireUser("client");

  return (
    <div className="pb-24">
      <ClientNav />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-4 pt-6">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-jcf-gray">Everything else</p>
        <h1 className="mb-2 font-display text-4xl uppercase leading-none tracking-wide">More</h1>
        <p className="mb-7 max-w-lg text-sm leading-relaxed text-jcf-gray">
          The stuff you need sometimes, without making the five things you use every day fight for space.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[20px] border border-white/10 bg-jcf-panel/75 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-0.5 hover:border-jcf-blue/30 hover:bg-jcf-panel"
            >
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-jcf-blue">{item.eyebrow}</p>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl uppercase tracking-wide text-white">{item.title}</h2>
                <span className="text-jcf-gray transition-transform group-hover:translate-x-0.5">→</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-jcf-gray">{item.copy}</p>
            </Link>
          ))}
        </div>
        <div className="mt-6 md:hidden"><SignOutButton /></div>
      </main>
    </div>
  );
}
