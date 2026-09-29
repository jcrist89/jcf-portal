import { JcfIcon, type JcfIconName } from "@/components/JcfIcon";

const achievementIcons = new Set<JcfIconName>(["flag", "flame", "dumbbell", "trophy", "calendar", "target"]);

export function AchievementIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const name = icon && achievementIcons.has(icon as JcfIconName) ? (icon as JcfIconName) : "target";
  return <JcfIcon name={name} className={className} />;
}
