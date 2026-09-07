import { LegalPage } from "@/components/LegalPage";

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy">
    <p>We collect the account, training, nutrition, progress, and communication information you enter to provide the Jon Crist Fit coaching portal and support your coaching relationship.</p>
    <p>Your coach may view information you submit through the portal to deliver coaching. We use service providers such as Supabase, Vercel, Stripe, and email providers to run the service. Payment information is handled by Stripe and is not stored in this portal.</p>
    <p>We do not sell your personal information. We retain information while your account is active and as reasonably necessary for service, legal, and recordkeeping purposes. You may request access, correction, or deletion by contacting us below.</p>
    <p>For privacy requests, contact <a className="text-jcf-gold hover:underline" href="mailto:jon@joncristfit.com">jon@joncristfit.com</a>.</p>
  </LegalPage>;
}
