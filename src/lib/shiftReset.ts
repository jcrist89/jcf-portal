export const SHIFT_RESET_OFFER_CODE = "JCF_SHIFT_RESET_2026_11";
export const SHIFT_RESET_PAYMENT_LINK_ID = "plink_1UKsFCPdonTh59bbEoFxhv2M";
export const SHIFT_RESET_OPEN_DATE = "2026-10-26";
export const SHIFT_RESET_CLOSE_DATE = "2026-11-09"; // exclusive: cohort begins Nov 9
export const SHIFT_RESET_CAP = 10;

export function dateInNewYork(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function shiftResetEnrollmentOpen(
  paidCount: number,
  now: Date = new Date(),
): boolean {
  const today = dateInNewYork(now);
  return (
    today >= SHIFT_RESET_OPEN_DATE &&
    today < SHIFT_RESET_CLOSE_DATE &&
    paidCount < SHIFT_RESET_CAP
  );
}
