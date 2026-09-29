import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/PublicHeader";
import { LegalAcceptanceForm } from "@/components/LegalAcceptanceForm";
import { checkoutOffer } from "@/lib/checkoutOffers";
import { ATTR_VISITOR_COOKIE } from "@/lib/attribution";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  legalRequirementsForOffer,
  missingLegalAcceptances,
} from "@/server/legalRequirements";

export const dynamic = "force-dynamic";

export default async function AgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ offer?: string }>;
}) {
  const params = await searchParams;
  const offerSlug = String(params.offer ?? "");
  const offer = checkoutOffer(offerSlug);
  if (!offer) redirect("/pricing");

  const admin = supabaseAdmin();
  const legal = await legalRequirementsForOffer(admin, offer.offerCode, "pre_checkout");

  if (legal.misconfigured) {
    return (
      <Shell>
        <p className="text-jcf-danger text-xs uppercase tracking-widest mb-2">Checkout unavailable</p>
        <h1 className="font-display uppercase text-3xl mb-3">Agreement setup needs review.</h1>
        <p className="text-jcf-gray text-sm">
          A required agreement is enabled but no active reviewed document version is configured. No payment has been taken.
        </p>
      </Shell>
    );
  }

  if (legal.requirements.length === 0) redirect(`/go/${offerSlug}`);

  const cookieStore = await cookies();
  const visitorId = cookieStore.get(ATTR_VISITOR_COOKIE)?.value ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) redirect(`/go/${offerSlug}`);

  const missing = await missingLegalAcceptances(admin, visitorId, legal.requirements);
  if (missing.length === 0) redirect(`/go/${offerSlug}`);

  const docs = missing
    .map((requirement) => requirement.document)
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      version: doc.version,
      urlPath: doc.url_path,
    }));

  return (
    <Shell>
      <p className="text-[#f97316] text-xs uppercase tracking-[0.3em] mb-3">Before Checkout</p>
      <h1 className="font-display uppercase text-3xl sm:text-4xl tracking-tight mb-4">
        Review The Current Agreement.
      </h1>
      <p className="text-jcf-gray text-sm leading-relaxed mb-6">
        These are the reviewed documents currently required for this offer. Checkout continues only after the exact active versions below are accepted.
      </p>
      <LegalAcceptanceForm offer={offerSlug} documents={docs} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main id="main-content" className="px-6 py-16 sm:py-20">
        <div className="max-w-2xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
