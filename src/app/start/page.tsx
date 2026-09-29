import { PublicHeader } from "@/components/PublicHeader";
import { PublicLeadForm } from "@/components/PublicLeadForm";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ interest?: string }>;
}) {
  const params = await searchParams;
  const interest = String(params.interest ?? "").slice(0, 120);

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main id="main-content" className="px-6 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-[#FF6B1A] text-xs uppercase tracking-[0.3em] mb-3">Coaching Inquiry</p>
          <h1 className="font-display uppercase text-4xl sm:text-6xl leading-none tracking-tight mb-4">
            Tell Me What You&apos;re Trying To Fix.
          </h1>
          <p className="text-jcf-gray text-sm sm:text-base leading-relaxed mb-8">
            You do not need a perfect schedule or a detailed fitness résumé. Give me the goal, the part that keeps going wrong, and a way to reach you. I&apos;ll use that to figure out whether local, remote, private training, or something simpler makes sense.
          </p>
          <PublicLeadForm initialInterest={interest} />
        </div>
      </main>
    </div>
  );
}
