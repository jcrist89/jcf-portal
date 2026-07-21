import Image from "next/image";

// Source asset ratios (width / height):
//   logo-mark.png     631 / 217  ≈ 2.908
//   logo-wordmark.png 1450 / 227 ≈ 6.388
const MARK_RATIO = 631 / 217;
const WORDMARK_RATIO = 1450 / 227;

const MARK_HEIGHTS = { sm: 28, md: 40, lg: 64 } as const;

export function JcfLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const h = MARK_HEIGHTS[size];
  return (
    <Image
      src="/logo-mark.png"
      alt="JCF"
      height={h}
      width={Math.round(h * MARK_RATIO)}
      priority
      className="select-none"
    />
  );
}

export function JcfWordmark() {
  const h = 40;
  return (
    <div className="flex flex-col">
      <Image
        src="/logo-wordmark.png"
        alt="Jon Crist Fit"
        height={h}
        width={Math.round(h * WORDMARK_RATIO)}
        priority
        className="select-none"
      />
      <span className="text-[10px] uppercase tracking-[0.25em] text-jcf-gray mt-1">
        Simple Training // Consistent Effort
      </span>
    </div>
  );
}
