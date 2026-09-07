import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { CoachNav } from "@/components/CoachNav";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { NotificationOptIn } from "@/components/NotificationOptIn";
import Link from "next/link";

export default async function SettingsPage() {
  const { session: user } = await requireUser();

  return (
    <div className="pb-24">
      {user.role === "coach" ? <CoachNav /> : <ClientNav />}
      <main id="main-content" tabIndex={-1} className="px-4 pt-6 max-w-md mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-6">Settings</h1>
        <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
          <div className="text-jcf-gray text-xs uppercase tracking-widest mb-1">Signed in as</div>
          <div className="text-white">{user.email} · {user.role}</div>
        </div>
        <div className="mb-4">
          <NotificationOptIn role={user.role} />
        </div>
        <ChangePasswordForm />
        <section className="mt-6 bg-jcf-panel border border-white/10 rounded-sm p-4">
          <h2 className="text-xs uppercase tracking-widest text-jcf-gray mb-3">Help &amp; policies</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/support" className="text-jcf-gold hover:underline">Contact support</Link>
            <Link href="/health-disclaimer" className="text-jcf-gold hover:underline">Health disclaimer</Link>
            <Link href="/privacy" className="text-jcf-gold hover:underline">Privacy</Link>
            <Link href="/terms" className="text-jcf-gold hover:underline">Terms</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
