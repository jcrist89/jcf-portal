import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkoutOffer } from "@/lib/checkoutOffers";
import { ATTR_VISITOR_COOKIE } from "@/lib/attribution";
import { legalRequirementsForOffer } from "@/server/legalRequirements";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const offerSlug = String(body?.offer ?? "");
  const offer = checkoutOffer(offerSlug);
  if (!offer) return NextResponse.json({ error: "Invalid offer." }, { status: 400 });

  const visitorId = req.cookies.get(ATTR_VISITOR_COOKIE)?.value ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) {
    return NextResponse.json({ error: "Checkout session could not be identified." }, { status: 400 });
  }

  const submittedIds = Array.isArray(body?.documentIds)
    ? new Set(body.documentIds.map((id: unknown) => String(id)))
    : new Set<string>();

  const admin = supabaseAdmin();
  const legal = await legalRequirementsForOffer(admin, offer.offerCode, "pre_checkout");
  if (legal.misconfigured || legal.requirements.length === 0) {
    return NextResponse.json({ error: "Agreement requirements are not available." }, { status: 409 });
  }

  const documents = legal.requirements
    .map((requirement) => requirement.document)
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc));

  if (documents.some((doc) => !submittedIds.has(doc.id))) {
    return NextResponse.json({ error: "Accept each required document." }, { status: 400 });
  }

  const rows = documents.map((doc) => ({
    document_id: doc.id,
    document_code: doc.document_code,
    document_version: doc.version,
    offer_code: offer.offerCode,
    visitor_id: visitorId,
    acceptance_source: "pre_checkout",
    accepted_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("jcf_agreement_acceptances")
    .upsert(rows, { onConflict: "visitor_id,document_id,offer_code" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
