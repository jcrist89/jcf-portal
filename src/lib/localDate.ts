/**
 * Local-date resolution.
 *
 * Every date-bearing write used to be `new Date().toISOString().slice(0, 10)` — the
 * UTC calendar day. For the client this app is built around, that is wrong roughly
 * every time it matters: a night-shift worker finishing at 01:30 Tuesday in Toronto is
 * 05:30 Wednesday in UTC, so his session, his habits and his streak all landed on the
 * wrong day.
 *
 * A "training day" also isn't midnight-to-midnight for someone working nights. The
 * boundary is configurable per client: with a 4am boundary, anything logged before
 * 04:00 local counts toward the previous day, which is the day the client believes he
 * trained on.
 */

export const DEFAULT_TIMEZONE = "America/Toronto";

/** Hour (local) at which a new training day starts. Before this, the day before. */
export const DEFAULT_DAY_BOUNDARY_HOUR = 4;

/** The calendar date in `timezone`, as YYYY-MM-DD. */
export function localDateIn(timezone: string, at: Date = new Date()): string {
  return formatter(timezone).format(at);
}

/**
 * The training date in `timezone` — the local calendar date, shifted back one day for
 * anything logged before the day boundary. Use this for workouts, habits and check-ins;
 * use localDateIn for anything that genuinely means "the calendar date".
 */
export function trainingDateIn(
  timezone: string,
  at: Date = new Date(),
  boundaryHour: number = DEFAULT_DAY_BOUNDARY_HOUR,
): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(timezone), hour: "2-digit", hour12: false })
      .format(at),
  );
  const shifted = hour < boundaryHour ? new Date(at.getTime() - 24 * 60 * 60 * 1000) : at;
  return localDateIn(timezone, shifted);
}

/**
 * Accepts a client-supplied local date only if it's within a day of what the server
 * resolves for that timezone — permissive enough for a write that was queued offline
 * overnight and syncs in the morning, strict enough to reject anything arbitrary.
 * Falls back to the server's own answer when the supplied value doesn't hold up.
 */
export function resolveLocalDate(
  supplied: unknown,
  timezone: string,
  at: Date = new Date(),
): string {
  const serverDate = trainingDateIn(timezone, at);
  if (typeof supplied !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(supplied)) return serverDate;

  const drift = Math.abs(Date.parse(`${supplied}T00:00:00Z`) - Date.parse(`${serverDate}T00:00:00Z`));
  return drift <= 24 * 60 * 60 * 1000 ? supplied : serverDate;
}

function safeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function formatter(timezone: string): Intl.DateTimeFormat {
  // en-CA renders as YYYY-MM-DD, which is both what Postgres wants and what sorts
  // correctly as a plain string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
