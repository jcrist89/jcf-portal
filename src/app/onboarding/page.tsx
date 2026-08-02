import { redirect } from "next/navigation";
import { supabaseForRequest } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/OnboardingForm";
import { CheckoutStatusBanner } from "@/components/CheckoutStatusBanner";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { checkout?: string };
}) {
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client, session } = ctx;

  if (session.onboarded) redirect(session.role === "coach" ? "/coach" : "/dashboard");

  const { data: profile } = await client
    .from("profiles")
    .select("goal, tier, subscription_status")
    .eq("id", session.id)
    .maybeSingle();

  const checkoutStatus = searchParams.checkout === "success" ? "success" : searchParams.checkout === "cancelled" ? "cancelled" : null;
  const planActive = profile?.tier !== "free" && profile?.subscription_status === "active";

  return (
    <>
      {checkoutStatus && (
        <div className="w-full flex justify-center px-6 pt-6">
          <CheckoutStatusBanner status={checkoutStatus} planActive={!!planActive} tier={profile?.tier ?? null} />
        </div>
      )}
      <OnboardingForm existingGoal={profile?.goal ?? null} />
    </>
  );
}
