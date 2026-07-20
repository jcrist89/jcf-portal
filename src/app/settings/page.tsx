import { requireUser } from "@/lib/auth/require";
import { ClientNav } from "@/components/ClientNav";
import { CoachNav } from "@/components/CoachNav";
import { ChangePinForm } from "@/components/ChangePinForm";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="pb-24">
      {user.role === "coach" ? <CoachNav /> : <ClientNav />}
      <main className="px-4 pt-6 max-w-md mx-auto">
        <h1 className="font-display text-2xl uppercase tracking-wide mb-6">Settings</h1>
        <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 mb-4">
          <div className="text-jcf-gray text-xs uppercase tracking-widest mb-1">Signed in as</div>
          <div className="text-white">@{user.username} · {user.role}</div>
        </div>
        <ChangePinForm />
      </main>
    </div>
  );
}
