import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";

const LOCAL_CHECKOUT = "/go/local-pif";
const PRIVATE_CHECKOUT = "/go/private";
const RESET_CHECKOUT = "/go/reset";
const INSTAGRAM = "https://www.instagram.com/joncristfit/";

const offers = [
  {
    name: "Local 12-Week Coaching",
    price: "$399",
    detail: "paid in full · or 3 × $150 arranged directly",
    description:
      "Individualized programming and coaching built around your actual schedule. Private training sessions are separate.",
    features: [
      "Individualized training plan",
      "JCF client app and workout tracking",
      "General nutrition guidance",
      "Progress review every four weeks",
      "Program updates every four weeks",
      "Direct coaching support for questions and adjustments",
    ],
    href: LOCAL_CHECKOUT,
    cta: "Start Local Coaching",
    featured: true,
  },
  {
    name: "Private Training",
    price: "$45",
    detail: "60-minute session at Hybrid Strength",
    description:
      "Hands-on coaching when you want technique work, exercise setup, accountability, or a fully coached training day.",
    features: [
      "60-minute private session",
      "Technique and movement coaching",
      "Exercise setup and substitutions",
      "Scheduled separately from coaching",
    ],
    href: PRIVATE_CHECKOUT,
    cta: "Book A Session",
    featured: false,
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main id="main-content">
        <section className="px-6 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <p className="text-[#f97316] text-xs uppercase tracking-[0.3em] mb-3">Local Coaching</p>
            <h1 className="font-display uppercase text-3xl sm:text-5xl tracking-tight mb-4">
              Buy The System. Add Sessions When You Need Them.
            </h1>
            <p className="text-jcf-gray text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              The coaching package builds and adjusts the plan. Private sessions are a separate tool,
              not a requirement to keep paying for the program.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid gap-5 md:grid-cols-2 items-stretch">
            {offers.map((offer) => (
              <article
                key={offer.name}
                className={`flex flex-col rounded-sm p-6 border ${
                  offer.featured
                    ? "bg-[#f97316]/10 border-[#f97316]"
                    : "bg-jcf-panel border-white/10"
                }`}
              >
                <h2 className="font-display uppercase text-xl tracking-wide mb-2">{offer.name}</h2>
                <div className="mb-4">
                  <span className="font-display text-3xl text-[#f97316]">{offer.price}</span>
                  <p className="text-jcf-gray text-xs mt-1">{offer.detail}</p>
                </div>
                <p className="text-jcf-gray text-sm leading-relaxed mb-5">{offer.description}</p>
                <ul className="flex flex-col gap-2 mb-8 text-sm text-white flex-1">
                  {offer.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-[#2563eb] font-bold">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={offer.href}
                  className="text-center uppercase tracking-widest text-xs font-bold bg-[#f97316] text-black px-4 py-3 rounded-sm hover:opacity-90"
                >
                  {offer.cta}
                </a>
                {offer.featured && (
                  <a
                    href={INSTAGRAM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center uppercase tracking-widest text-xs font-semibold border border-[#2563eb] text-white px-4 py-3 rounded-sm mt-2 hover:bg-[#2563eb]/10"
                  >
                    Ask About 3 × $150
                  </a>
                )}
              </article>
            ))}
          </div>

          <section className="max-w-4xl mx-auto mt-8 bg-jcf-panel border border-[#2563eb]/60 p-6 rounded-sm">
            <p className="text-[#60a5fa] text-xs uppercase tracking-[0.25em] mb-2">Remote Coaching</p>
            <h2 className="font-display uppercase text-2xl mb-2">Not Local? That&apos;s Fine.</h2>
            <p className="text-jcf-gray text-sm leading-relaxed max-w-2xl">
              Remote 12-week coaching is available for clients who need individualized programming,
              weekly review, and adjustments without in-person sessions. Remote pricing is discussed
              during the coaching conversation so the offer matches what you actually need.
            </p>
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-5 uppercase tracking-widest text-xs font-bold bg-[#2563eb] text-white px-4 py-3 rounded-sm hover:opacity-90"
            >
              Ask About Remote Coaching
            </a>
          </section>

          <section className="max-w-4xl mx-auto mt-8 bg-[#0b1220] border border-white/10 p-6 rounded-sm">
            <p className="text-[#f97316] text-xs uppercase tracking-[0.25em] mb-2">November 9–22, 2026</p>
            <h2 className="font-display uppercase text-2xl mb-2">14-Day Shift Reset Beta</h2>
            <p className="text-jcf-gray text-sm leading-relaxed">
              A $27 beta for shift workers and busy adults who are tired of one rough week turning into
              a month off-track. Limited to 10 paid participants.
            </p>
            <a
              href={RESET_CHECKOUT}
              className="inline-block mt-5 uppercase tracking-widest text-xs font-bold bg-[#f97316] text-black px-4 py-3 rounded-sm hover:opacity-90"
            >
              Join The Shift Reset
            </a>
          </section>

          <p className="max-w-4xl mx-auto text-jcf-gray text-xs mt-8 leading-relaxed">
            Coaching provides general fitness and nutrition education and is not medical care.
            Existing clients keep the terms of their existing agreements.
          </p>
        </section>
      </main>
    </div>
  );
}
