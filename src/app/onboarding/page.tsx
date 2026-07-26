import { redirect } from "next/navigation";
import { supabaseForRequest } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const ctx = await supabaseForRequest();
  if (!ctx) redirect("/login");
  const { client, session } = ctx;

  if (session.onboarded) redirect(session.role === "coach" ? "/coach" : "/dashboard");

  const { data: profile } = await client.from("profiles").select("goal").eq("id", session.id).maybeSingle();

  return <OnboardingForm existingGoal={profile?.goal ?? null} />;
}
