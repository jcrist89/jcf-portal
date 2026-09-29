import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/require";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/Button";

const PILLARS = [
  {
    title: "Built Around Real Life",
    desc: "Your training plan is built around your schedule, equipment, experience, and goal instead of pretending every week is perfect.",
  },
  {
    title: "Progress With A System",
    desc: "Track the work, review the data, and change the plan when the evidence says it needs to change.",
  },
  {
    title: "Coaching, Not Fitness Theater",
    desc: "Strength, Tension, and Development with practical nutrition guidance and a plan that survives busy weeks.",
  },
];

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect(user.role === "coach" ? "/coach" : "/dashboard");

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main id="main-content">
        <section className="relative overflow-hidden px-6 py-24 sm:py-32">
          <div className="absolute inset-0 bg-diagonal-fade pointer-events-none" />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <p className="text-[#FF6B1A] text-xs uppercase tracking-[0.3em] mb-4">Jon Crist Fit</p>
            <h1 className="font-display uppercase text-4xl sm:text-6xl tracking-tight leading-[1.05] mb-6">
              Fitness That Works
              <br />
              When Life Doesn&apos;t
            </h1>
            <p className="text-jcf-gray text-base sm:text-lg max-w-2xl mx-auto mb-10">
              Individualized training, practical nutrition guidance, and coaching built for shift
              workers, busy adults, and people who are tired of restarting every time the week gets ugly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/pricing">
                <Button className="w-full sm:w-auto px-8 py-3 text-base">View Coaching</Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" className="w-full sm:w-auto px-8 py-3 text-base">
                  Client Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-3">
            {PILLARS.map((p, index) => (
              <div key={p.title} className="bg-jcf-panel/90 border border-white/10 rounded-2xl p-6 shadow-[0_18px_54px_rgba(0,0,0,0.20)]">
                <div className={`h-1 w-10 mb-5 ${index % 2 === 0 ? "bg-[#FF6B1A]" : "bg-[#59A9DC]"}`} />
                <h3 className="font-display uppercase tracking-wide text-white mb-2">{p.title}</h3>
                <p className="text-jcf-gray text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="px-6 py-8 border-t border-white/10 text-center text-jcf-gray text-xs uppercase tracking-widest">
        Jon Crist Fit
      </footer>
    </div>
  );
}
