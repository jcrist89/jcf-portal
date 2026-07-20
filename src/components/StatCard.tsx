export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-jcf-panel border border-white/10 rounded-sm p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 bg-diagonal-fade" />
      <div className="text-[11px] uppercase tracking-widest text-jcf-gray mb-1">{label}</div>
      <div className="text-2xl font-display font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-jcf-gray mt-1">{sub}</div>}
    </div>
  );
}
