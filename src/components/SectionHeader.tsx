export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display uppercase tracking-wider text-sm text-jcf-gold">{title}</h2>
      {action}
    </div>
  );
}
