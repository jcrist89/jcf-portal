import { differenceInCalendarDays, differenceInCalendarWeeks, parseISO } from "date-fns";

export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = dates.map((d) => parseISO(d)).sort((a, b) => a.getTime() - b.getTime());
  const weeks = Array.from(
    new Set(sorted.map((d) => differenceInCalendarWeeks(d, sorted[0], { weekStartsOn: 1 })))
  ).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] + 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 1;
  }
  return longest;
}

export function buildNudge(
  daysSinceLog: number | null,
  accountAgeDays: number,
  streak: number
): { level: "warning" | "danger"; text: string } | null {
  if (daysSinceLog == null) {
    if (accountAgeDays >= 2) {
      return { level: "warning", text: "You haven't logged a workout yet — knock out your first one today." };
    }
    return null;
  }
  if (daysSinceLog >= 14) {
    return {
      level: "danger",
      text: `It's been ${daysSinceLog} days since your last log. Let's get back on track today.`,
    };
  }
  if (daysSinceLog >= 7) {
    return {
      level: "danger",
      text: `It's been ${daysSinceLog} days since your last workout — your streak's at risk.`,
    };
  }
  if (daysSinceLog >= 3 && streak >= 2) {
    return {
      level: "warning",
      text: `${daysSinceLog} days since your last log — keep the ${streak}-week streak alive.`,
    };
  }
  return null;
}

export function daysSinceLastLog(lastLogDate: string | null): number | null {
  return lastLogDate ? differenceInCalendarDays(new Date(), parseISO(lastLogDate)) : null;
}

export function accountAgeInDays(createdAt: string): number {
  return differenceInCalendarDays(new Date(), parseISO(createdAt));
}
