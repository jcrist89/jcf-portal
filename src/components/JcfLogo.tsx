const MARK_SIZES = {
  sm: "text-[28px] leading-[0.72]",
  md: "text-[40px] leading-[0.72]",
  lg: "text-[64px] leading-[0.72]",
} as const;

/** The orange C is the center of the identity, framed by the blue J and F. */
export function JcfLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-label="Jon Crist Fit"
      className={`inline-flex origin-left -skew-x-[7deg] select-none font-display font-normal tracking-[-0.12em] ${MARK_SIZES[size]}`}
    >
      <span className="text-jcf-blue">J</span>
      <span className="text-jcf-orange">C</span>
      <span className="text-jcf-blue">F</span>
    </span>
  );
}

export function JcfWordmark() {
  return (
    <span className="inline-flex items-center gap-3 select-none">
      <JcfLogo size="md" />
      <span className="flex flex-col border-l border-jcf-blue/30 pl-3 leading-none">
        <span className="font-display text-[19px] tracking-[0.075em] text-jcf-white">JON CRIST FIT</span>
        <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-jcf-gray">
          Simple Training // Consistent Effort
        </span>
      </span>
    </span>
  );
}
