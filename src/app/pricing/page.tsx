import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { Button } from "@/components/Button";

const TIERS = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    period: "",
    tagline: "Get your program and start logging.",
    features: [
      "Template program for your goal",
      "Full workout logging (sets, reps, weight, RPE)",
      "Progress tracking & PR log",
      "Achievements & streaks",
    ],
    cta: "Start Free",
  },
  {
    tier: "paid_programming",
    name: "Programming",
    price: "$10",
    period: "/week",
    tagline: "Take control of your own program.",
    features: [
      "Everything in Free",
      "Edit your own exercises, sets, reps, RPE",
      "Full program customization",
    ],
    cta: "Get Programming",
  },
  {
    tier: "paid_coaching",
    name: "Coaching",
    price: "$50",
    period: "/week",
    tagline: "Jon in your corner, every week.",
    features: [
      "Everything in Programming",
      "Direct messaging with Jon",
      "Jon customizes your program directly",
      "Priority feedback on logged workouts",
    ],
    cta: "Get Coaching",
    featured: true,
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <section className="px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <p className="text-jcf-gold text-xs uppercase tracking-[0.3em] mb-3">Pricing</p>
          <h1 className="font-display uppercase text-3xl sm:text-4xl tracking-tight mb-3">
            Pick Your Level of Coaching
          </h1>
          <p className="text-jcf-gray text-sm max-w-lg mx-auto">
            Every tier gets a real program and full tracking. Higher tiers get more control and more
            of Jon.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid gap-5 sm:grid-cols-3 items-stretch">
          {TIERS.map((t) => (
            <div
              key={t.tier}
              className={`flex flex-col rounded-sm p-6 border ${
                "featured" in t && t.featured
                  ? "bg-jcf-gold/10 border-jcf-gold"
                  : "bg-jcf-panel border-white/10"
              }`}
            >
              <h2 className="font-display uppercase text-xl tracking-wide mb-1">{t.name}</h2>
              <p className="text-jcf-gray text-xs uppercase tracking-widest mb-4">{t.tagline}</p>
              <div className="mb-6">
                <span className="font-display text-3xl text-jcf-gold">{t.price}</span>
                <span className="text-jcf-gray text-sm">{t.period}</span>
              </div>
              <ul className="flex flex-col gap-2 mb-8 text-sm text-white flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-jcf-gold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/signup?tier=${t.tier}`}>
                <Button
                  variant={"featured" in t && t.featured ? "primary" : "secondary"}
                  className="w-full"
                >
                  {t.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
