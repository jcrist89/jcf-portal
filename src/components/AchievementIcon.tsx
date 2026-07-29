import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  flag: <path d="M5 21V4m0 0h11l-2 3.5L16 11H5" />,
  flame: (
    <path d="M12 21.5c4.14 0 7-2.9 7-6.9 0-3-1.8-4.9-3.3-6.8.1 1.9-.7 3.1-1.8 2.7-.9-2.6-.2-5.2-2-7-.7 3-3.4 5.6-3.4 8.6-1.3-.4-1.8-1.8-1.8-3.3C5.3 9.9 5 11.9 5 13.4c0 4.5 3 8.1 7 8.1Z" />
  ),
  dumbbell: (
    <>
      <rect x="2.5" y="9" width="3.5" height="6" rx="1" />
      <rect x="18" y="9" width="3.5" height="6" rx="1" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="8.5" y1="10" x2="8.5" y2="14" />
      <line x1="15.5" y1="10" x2="15.5" y2="14" />
    </>
  ),
  trophy: (
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 5H5a2 2 0 0 0 0 4h1M16 5h3a2 2 0 0 1 0 4h-1M10 17h4M12 13v4M9 21h6" />
  ),
  calendar: (
    <path d="M4 9h16M7 3v3M17 3v3M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
  ),
  target: (
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
  ),
};

export function AchievementIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const content = (icon && ICONS[icon]) || ICONS.target;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {content}
    </svg>
  );
}
