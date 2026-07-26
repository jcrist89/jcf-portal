import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/require";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/Button";

const PILLARS = [
  {
    title: "Real Programming",
    desc: "Strength gain, fat loss, hybrid, or powerlifting — built on proven structure, not generic templates.",
  },
  {
    title: "Track Everything",
    desc: "Log every set, every check-in, every PR. Watch the trend lines move in the right direction.",
  },
  {
    title: "A Coach, Not an App",
    desc: "Jon sees your work the moment you log it. Coaching tiers get direct feedback, not just data.",
  },
];

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect(user.role === "coach" ? "/coach" : "/dashboard");

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <section className="relative overflow-hidden px-6 py-24 sm:py-32">
        <div className="absolute inset-0 bg-diagonal-fade pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-jcf-gold text-xs uppercase tracking-[0.3em] mb-4">Jon Crist Fit</p>
          <h1 className="font-display uppercase text-4xl sm:text-6xl tracking-tight leading-[1.05] mb-6">
            Simple Training
            <br />
            Consistent Effort
          </h1>
          <p className="text-jcf-gray text-base sm:text-lg max-w-xl mx-auto mb-10">
            Real programming, real tracking, real coaching — built for lifters who want results
            without the noise. Pick a goal, get a program, and start logging today.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button className="w-full sm:w-auto px-8 py-3 text-base">Get Started</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" className="w-full sm:w-auto px-8 py-3 text-base">
                See Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="bg-jcf-panel border border-white/10 rounded-sm p-6">
              <h3 className="font-display uppercase tracking-wide text-jcf-gold mb-2">{p.title}</h3>
              <p className="text-jcf-gray text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-white/10 text-center text-jcf-gray text-xs uppercase tracking-widest">
        Jon Crist Fit
      </footer>
    </div>
  );
}
