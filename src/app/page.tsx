import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/require";
import { PublicHeader } from "@/components/PublicHeader";

const PILLARS = [
  {
    number: "01",
    title: "Built Around Real Life",
    desc: "Training that accounts for your schedule, equipment, experience, and the weeks that refuse to cooperate.",
  },
  {
    number: "02",
    title: "Progress With A System",
    desc: "Track the work, review the evidence, and adjust when the data says the plan needs to change.",
  },
  {
    number: "03",
    title: "Coaching, Not Fitness Theater",
    desc: "Strength, Tension, and Development with practical nutrition guidance and direct coaching support.",
  },
];

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect(user.role === "coach" ? "/coach" : "/dashboard");

  return (
    <div className="min-h-screen overflow-hidden">
      <PublicHeader />

      <main id="main-content">
        <section className="relative px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="pointer-events-none absolute right-[-10rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-jcf-blue/10 blur-[110px]" />
          <div className="pointer-events-none absolute bottom-[-10rem] left-[-10rem] h-[28rem] w-[28rem] rounded-full bg-jcf-gold/10 blur-[110px]" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.12fr_.88fr]">
            <div>
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.28em] text-jcf-blue">Jon Crist Fit</p>
              <h1 className="max-w-4xl font-display text-5xl uppercase leading-[0.96] tracking-tight text-white sm:text-7xl">
                Fitness That Works
                <br />
                <span className="text-jcf-gold">When Life Doesn&apos;t.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-jcf-gray sm:text-lg">
                Individualized training, practical nutrition guidance, and coaching built for shift workers, busy adults, and people tired of restarting every time the week gets ugly.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/pricing"
                  className="rounded-xl bg-jcf-gold px-6 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-jcf-black transition-all hover:brightness-105 active:translate-y-px"
                >
                  View Coaching
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/10 bg-jcf-panel/60 px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:border-jcf-blue/35 hover:bg-jcf-panel"
                >
                  Client Sign In
                </Link>
              </div>
            </div>

            <aside className="relative rounded-[28px] border border-white/10 bg-jcf-panel/80 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.3)] backdrop-blur">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-jcf-gray">The coaching system</p>
                  <h2 className="mt-1 font-display text-3xl uppercase leading-none text-white">Simple. Adaptive. Yours.</h2>
                </div>
                <div className="h-12 w-1 rounded-full bg-jcf-gold" />
              </div>

              <div className="space-y-3">
                {[
                  ["Training", "3–4 effective days built around your schedule"],
                  ["Nutrition", "Practical targets you can actually repeat"],
                  ["Accountability", "A coach who sees the data and adjusts"],
                ].map(([title, copy], index) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-jcf-black/30 p-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${index === 1 ? "bg-jcf-blue" : "bg-jcf-gold"}`} />
                      <div>
                        <h3 className="font-display text-xl uppercase tracking-wide text-white">{title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-jcf-gray">{copy}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="border-y border-white/10 bg-jcf-charcoal/50 px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 max-w-2xl">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-jcf-gold">How this is different</p>
              <h2 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
                A system for the week that goes sideways.
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {PILLARS.map((pillar) => (
                <article key={pillar.title} className="rounded-[22px] border border-white/10 bg-jcf-panel/75 p-6 shadow-[0_16px_45px_rgba(0,0,0,0.16)]">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-jcf-blue">{pillar.number}</span>
                  <h3 className="mt-5 font-display text-2xl uppercase leading-none tracking-wide text-white">{pillar.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-jcf-gray">{pillar.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-5xl rounded-[28px] border border-jcf-gold/20 bg-gradient-to-br from-jcf-panel to-jcf-charcoal p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-jcf-blue">No January required</p>
            <h2 className="mx-auto mt-3 max-w-3xl font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
              Stop waiting for life to calm down.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-jcf-gray">
              Build the plan around the life you already have, then make it stronger from there.
            </p>
            <Link
              href="/pricing"
              className="mt-7 inline-block rounded-xl bg-jcf-gold px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-jcf-black transition-all hover:brightness-105 active:translate-y-px"
            >
              See Coaching Options
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-jcf-gray">
        Jon Crist Fit · Simple Training // Consistent Effort
      </footer>
    </div>
  );
}
