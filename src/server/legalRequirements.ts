import type { SupabaseClient } from "@supabase/supabase-js";

export type LegalDocument = {
  id: string;
  document_code: string;
  version: string;
  title: string;
  status: "draft" | "active" | "retired";
  url_path: string;
  effective_on: string | null;
};

export type LegalRequirement = {
  offer_code: string;
  document_code: string;
  required_stage: "pre_checkout" | "onboarding";
  document: LegalDocument | null;
};

export async function legalRequirementsForOffer(
  client: SupabaseClient,
  offerCode: string,
  stage: "pre_checkout" | "onboarding" = "pre_checkout",
): Promise<{ requirements: LegalRequirement[]; misconfigured: boolean }> {
  const { data: rows, error } = await client
    .from("jcf_offer_legal_requirements")
    .select("offer_code,document_code,required_stage")
    .eq("offer_code", offerCode)
    .eq("required_stage", stage)
    .eq("enabled", true);

  if (error) throw error;
  if (!rows?.length) return { requirements: [], misconfigured: false };

  const codes = Array.from(new Set(rows.map((row) => row.document_code)));
  const { data: docs, error: docsError } = await client
    .from("jcf_legal_documents")
    .select("id,document_code,version,title,status,url_path,effective_on")
    .in("document_code", codes)
    .eq("status", "active");

  if (docsError) throw docsError;
  const byCode = new Map((docs ?? []).map((doc) => [doc.document_code, doc as LegalDocument]));

  const requirements = rows.map((row) => ({
    offer_code: row.offer_code,
    document_code: row.document_code,
    required_stage: row.required_stage as "pre_checkout" | "onboarding",
    document: byCode.get(row.document_code) ?? null,
  }));

  return {
    requirements,
    misconfigured: requirements.some((requirement) => requirement.document == null),
  };
}

export async function missingLegalAcceptances(
  client: SupabaseClient,
  visitorId: string,
  requirements: LegalRequirement[],
): Promise<LegalRequirement[]> {
  const documentIds = requirements
    .map((requirement) => requirement.document?.id)
    .filter((id): id is string => Boolean(id));

  if (documentIds.length === 0) return requirements.filter((requirement) => requirement.document == null);

  const { data: accepted, error } = await client
    .from("jcf_agreement_acceptances")
    .select("document_id")
    .eq("visitor_id", visitorId)
    .in("document_id", documentIds);

  if (error) throw error;
  const acceptedIds = new Set((accepted ?? []).map((row) => row.document_id));

  return requirements.filter(
    (requirement) => !requirement.document || !acceptedIds.has(requirement.document.id),
  );
}
