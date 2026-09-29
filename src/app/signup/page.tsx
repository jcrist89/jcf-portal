import { redirect } from "next/navigation";

// Public self-signup for the old Free / $10 / $50 tier model is retired.
// New paid coaching accounts are created after an approved Stripe checkout,
// then clients complete onboarding inside the existing JCF app.
export default function SignupPage() {
  redirect("/pricing");
}
