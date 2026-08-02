export function RouteLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center px-6" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-jcf-gray text-xs uppercase tracking-widest">
        <span className="w-2 h-2 rounded-full bg-jcf-gold animate-pulse" />
        {label}…
      </div>
    </div>
  );
}
