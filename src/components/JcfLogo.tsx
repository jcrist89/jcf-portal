export function JcfLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "text-xl", md: "text-3xl", lg: "text-5xl" }[size];
  return (
    <div className={`font-display font-bold tracking-tight ${dims} leading-none select-none`}>
      <span className="text-white">J</span>
      <span className="text-jcf-gold">C</span>
      <span className="text-white">F</span>
    </div>
  );
}

export function JcfWordmark() {
  return (
    <div className="flex flex-col">
      <JcfLogo size="md" />
      <span className="text-[10px] uppercase tracking-[0.25em] text-jcf-gray mt-1">
        Simple Training // Consistent Effort
      </span>
    </div>
  );
}
