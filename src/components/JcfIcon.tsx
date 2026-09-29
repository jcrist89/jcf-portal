import type { ReactNode } from "react";

export type JcfIconName =
  | "home" | "train" | "progress" | "coach" | "more" | "clients" | "checkin"
  | "leads" | "flag" | "flame" | "dumbbell" | "trophy" | "calendar" | "target";

const paths: Record<JcfIconName, ReactNode> = {
  home: <path d="m3.5 10.5 8.5-7 8.5 7V21h-5.5v-5.5h-6V21H3.5Z" />,
  train: <><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" /><path d="M8.5 9.5v5M15.5 9.5v5" /></>,
  progress: <><path d="m4 17 5-5 4 3 7-8" /><path d="M15 7h5v5" /></>,
  coach: <path d="M4 5h16v12H8l-4 4Z" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  clients: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M16 6.5a2.5 2.5 0 0 1 0 5M16.5 14c2.5.3 3.8 2 4 5" /></>,
  checkin: <><path d="M5 4h14v16H5Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
  leads: <><path d="M4 5h16v14H4Z" /><path d="M7 9h10M7 13h6" /></>,
  flag: <path d="M5 21V4m0 0h11l-2 3.5L16 11H5" />,
  flame: <path d="M12 21.5c4.14 0 7-2.9 7-6.9 0-3-1.8-4.9-3.3-6.8.1 1.9-.7 3.1-1.8 2.7-.9-2.6-.2-5.2-2-7-.7 3-3.4 5.6-3.4 8.6-1.3-.4-1.8-1.8-1.8-3.3C5.3 9.9 5 11.9 5 13.4c0 4.5 3 8.1 7 8.1Z" />,
  dumbbell: <><rect x="2.5" y="9" width="3.5" height="6" rx="1" /><rect x="18" y="9" width="3.5" height="6" rx="1" /><path d="M6 12h12M8.5 10v4M15.5 10v4" /></>,
  trophy: <path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 5H5a2 2 0 0 0 0 4h1M16 5h3a2 2 0 0 1 0 4h-1M10 17h4M12 13v4M9 21h6" />,
  calendar: <path d="M4 9h16M7 3v3M17 3v3M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
  target: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />,
};

export function JcfIcon({ name, className }: { name: JcfIconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}
