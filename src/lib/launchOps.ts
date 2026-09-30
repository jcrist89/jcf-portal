export const OCTOBER_BASELINE_TARGETS = {
  newLeads: 10,
  qualified: 6,
  booked: 4,
  attended: 3,
  won: 1,
  contractedCents: 39900,
} as const;

export const OCTOBER_TARGET_NOTE =
  "October baseline. Recalibrate after four complete cohorts using actual conversion data.";

export const CAMPAIGN_TAXONOMY = {
  sources: ["instagram", "website", "referral", "in_person", "email"],
  mediums: ["bio", "reel", "story", "carousel", "dm", "referral", "organic", "direct"],
  campaigns: {
    core: "2026_10_core",
    reset: "2026_10_shift_reset",
    referral: "2026_10_referral",
  },
  contentPattern:
    "<format>_YYYYMMDD_<topic>[_v#], e.g. reel_20261003_night_shift_protein",
} as const;

export const LAUNCH_LINKS = [
  {
    key: "bio_main",
    label: "Instagram bio — coaching inquiry",
    purpose: "Primary bio destination",
    path: "/start?utm_source=instagram&utm_medium=bio&utm_campaign=2026_10_core&utm_content=bio_main",
  },
  {
    key: "dm_local_pif",
    label: "DM — Local $399 PIF",
    purpose: "Warm prospect ready to buy",
    path: "/go/local-pif?utm_source=instagram&utm_medium=dm&utm_campaign=2026_10_core&utm_content=dm_local_pif",
  },
  {
    key: "dm_local_3pay",
    label: "DM — Local 3 × $150 inquiry",
    purpose: "Installment conversation",
    path: "/start?interest=local-3pay&utm_source=instagram&utm_medium=dm&utm_campaign=2026_10_core&utm_content=dm_local_3pay",
  },
  {
    key: "dm_remote",
    label: "DM — Remote coaching inquiry",
    purpose: "Remote prospect qualification",
    path: "/start?interest=remote&utm_source=instagram&utm_medium=dm&utm_campaign=2026_10_core&utm_content=dm_remote",
  },
  {
    key: "story_private",
    label: "Story — Private training",
    purpose: "Private-session CTA",
    path: "/go/private?utm_source=instagram&utm_medium=story&utm_campaign=2026_10_core&utm_content=story_private",
  },
  {
    key: "reset_prelaunch",
    label: "Shift Reset — prelaunch interest",
    purpose: "Collect interest before Oct 26",
    path: "/start?interest=shift-reset&utm_source=instagram&utm_medium=story&utm_campaign=2026_10_shift_reset&utm_content=story_reset_prelaunch",
  },
  {
    key: "reset_enroll",
    label: "Shift Reset — enrollment",
    purpose: "Use Oct 26–Nov 8 only",
    path: "/go/reset?utm_source=instagram&utm_medium=story&utm_campaign=2026_10_shift_reset&utm_content=story_reset_enroll",
  },
] as const;

export const LAUNCH_MILESTONES = [
  { date: "2026-10-01", label: "October acquisition system starts" },
  { date: "2026-10-11", label: "Shift Reset curriculum finalized" },
  { date: "2026-10-20", label: "Shift Reset launch content ready" },
  { date: "2026-10-26", label: "Shift Reset enrollment opens" },
  { date: "2026-11-08", label: "Shift Reset roster closes" },
  { date: "2026-11-09", label: "Shift Reset beta begins" },
  { date: "2026-11-22", label: "Shift Reset beta ends" },
  { date: "2026-11-23", label: "Post-beta review + conversion follow-up" },
] as const;

export function newYorkDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return `${map.get("year")}-${map.get("month")}-${map.get("day")}`;
}

export function mondayOfWeek(dateString: string): string {
  const [y,m,d] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0,10);
}

export function progress(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}


export function newYorkMidnightUtc(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
    hour: "2-digit",
  }).formatToParts(noonUtc);
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-05:00";
  const match = zone.match(/GMT([+-])(\d{2}):(\d{2})/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const offsetMinutes = match
    ? sign * (Number(match[2]) * 60 + Number(match[3]))
    : -300;
  const utcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
}
