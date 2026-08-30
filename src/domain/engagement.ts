/**
 * Engagement rules. Pure — no Supabase, no Next, no React.
 *
 * An engagement is the commercial relationship: when it started, when it ends, what was
 * agreed, and what the client can therefore do. Everything the app needs to say about
 * "week 6 of 12", renewal timing, and access after an engagement ends comes from here
 * and nowhere else, so the client screen and the coach screen cannot disagree.
 */

import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

export type BillingKind =
  | "stripe_subscription"
  | "stripe_payment"
  | "manual_invoice"
  | "complimentary";

export type RateKind = "standard" | "grandfathered" | "founding" | "comp";

export type EngagementStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled"
  | "completed"
  | "renewed";

export type EngagementMode = "general" | "meet_prep";

export interface Engagement {
  id: string;
  profile_id: string;
  offer_code: string;
  agreed_amount_cents: number | null;
  currency: string | null;
  starts_on: string;
  /** Null means open-ended: a comp arrangement, or one with no agreed finish. */
  ends_on: string | null;
  engagement_weeks: number | null;
  checkin_weekday: number;
  day_boundary_hour: number;
  billing_kind: BillingKind;
  rate_kind: RateKind;
  status: EngagementStatus;
  mode: EngagementMode;
}

/** How long a finished engagement stays readable before it's archived. */
export const GRACE_DAYS_AFTER_END = 30;

/** How far ahead of the end date the renewal conversation should surface. */
export const RENEWAL_WINDOW_DAYS = 14;

export interface EngagementPosition {
  /** 1-based week of the engagement, or null when it hasn't started. */
  week: number | null;
  /** Total weeks, derived from the dates when both are known. Null when open-ended. */
  totalWeeks: number | null;
  /** Whole weeks left before ends_on. Null when open-ended. Never negative. */
  weeksRemaining: number | null;
  /** Days until ends_on. Negative once past. Null when open-ended. */
  daysRemaining: number | null;
  isOpenEnded: boolean;
  /** Past ends_on but still inside the grace window. */
  inGracePeriod: boolean;
  /** Past ends_on and past the grace window. */
  archived: boolean;
  /** Inside the renewal window, or already past the end and still recoverable. */
  renewalDue: boolean;
  /** Renderable "Week 6 of 12", or null when there's nothing honest to show. */
  label: string | null;
}

export interface Entitlements {
  /** Can open sessions, log sets, tap habits, submit check-ins. */
  canTrain: boolean;
  /** Can message the coach. */
  canMessage: boolean;
  /** Can see history and program but not write anything. */
  readOnly: boolean;
  /** Nothing is reachable; the engagement is over and out of its grace window. */
  archived: boolean;
}

const NO_ENGAGEMENT: EngagementPosition = {
  week: null,
  totalWeeks: null,
  weeksRemaining: null,
  daysRemaining: null,
  isOpenEnded: true,
  inGracePeriod: false,
  archived: false,
  renewalDue: false,
  label: null,
};

/**
 * Where a client is in their engagement.
 *
 * Week is counted from starts_on, and the total is derived from the dates rather than
 * from engagement_weeks — an engagement bound to an event (a meet on a fixed date) has
 * a real end date and only an approximate week count, so the dates are the truth and
 * the stored week count is a convenience. When they disagree, the dates win.
 */
export function engagementPosition(
  engagement: Engagement | null,
  today: Date = new Date(),
): EngagementPosition {
  if (!engagement) return NO_ENGAGEMENT;

  const startsOn = parseISO(engagement.starts_on);
  const daysSinceStart = differenceInCalendarDays(today, startsOn);

  // Not started yet — an engagement can be created ahead of its start date.
  const week = daysSinceStart < 0 ? null : Math.floor(daysSinceStart / 7) + 1;

  if (!engagement.ends_on) {
    return {
      ...NO_ENGAGEMENT,
      week,
      isOpenEnded: true,
      label: null, // "Week 6 of ∞" says nothing; show nothing.
    };
  }

  const endsOn = parseISO(engagement.ends_on);
  const totalDays = differenceInCalendarDays(endsOn, startsOn);
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const daysRemaining = differenceInCalendarDays(endsOn, today);
  const weeksRemaining = Math.max(0, Math.ceil(daysRemaining / 7));

  const daysPastEnd = -daysRemaining;
  const inGracePeriod = daysPastEnd > 0 && daysPastEnd <= GRACE_DAYS_AFTER_END;
  const archived = daysPastEnd > GRACE_DAYS_AFTER_END;

  return {
    week,
    totalWeeks,
    weeksRemaining,
    daysRemaining,
    isOpenEnded: false,
    inGracePeriod,
    archived,
    // Surfaces once inside the window, and stays up through the grace period —
    // the conversation is still winnable the week after an engagement lapses.
    renewalDue:
      engagement.status === "active" &&
      daysRemaining <= RENEWAL_WINDOW_DAYS &&
      !archived,
    label: week != null && week <= totalWeeks ? `Week ${week} of ${totalWeeks}` : null,
  };
}

/**
 * What a client can do right now.
 *
 * Derived from the engagement's own state, never from whether money changed hands — a
 * complimentary arrangement and a paid-in-full one grant exactly the same access, which
 * is the whole reason entitlements live here instead of on a tier column.
 */
export function entitlementsFor(
  engagement: Engagement | null,
  today: Date = new Date(),
): Entitlements {
  if (!engagement) {
    return { canTrain: false, canMessage: false, readOnly: true, archived: false };
  }

  const position = engagementPosition(engagement, today);

  if (position.archived || engagement.status === "canceled") {
    return { canTrain: false, canMessage: false, readOnly: true, archived: true };
  }

  // Read-only for the grace window after an engagement ends: history and program stay
  // visible, writing stops. A locked door is a bad last impression; an open window is a
  // win-back channel.
  if (position.inGracePeriod || engagement.status === "completed") {
    return { canTrain: false, canMessage: true, readOnly: true, archived: false };
  }

  // past_due keeps full access on purpose. Cutting a client off over a failed card is
  // how a billing hiccup becomes a churn event; the coach gets a signal instead.
  const live =
    engagement.status === "active" ||
    engagement.status === "past_due" ||
    engagement.status === "pending";

  return {
    canTrain: live,
    canMessage: live,
    readOnly: !live,
    archived: false,
  };
}

/** The date this client's next check-in is due, on or after `from`. */
export function nextCheckinDue(engagement: Engagement | null, from: Date = new Date()): Date | null {
  if (!engagement) return null;
  const offset = (engagement.checkin_weekday - from.getDay() + 7) % 7;
  return addDays(from, offset);
}
