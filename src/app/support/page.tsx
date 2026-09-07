import { LegalPage } from "@/components/LegalPage";

export default function SupportPage() {
  return <LegalPage title="Support">
    <p>Need help with your account, program, nutrition log, or billing? Email <a className="text-jcf-gold hover:underline" href="mailto:jon@joncristfit.com">jon@joncristfit.com</a>.</p>
    <p>For coaching questions, use Messages in the portal so your coach can see the training context.</p>
    <p>For an urgent medical concern, contact emergency services or a qualified healthcare professional — not portal support.</p>
  </LegalPage>;
}
