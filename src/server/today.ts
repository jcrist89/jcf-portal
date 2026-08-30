import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { schedulePosition, type SchedulePosition } from "@/domain/schedule";
import { consistency, type Consistency, type HabitDay } from "@/domain/consistency";
import { engagementPosition, nextCheckinDue, type Engagement } from "@/domain/engagement";
import { loadSchedule, loadSessionExercises, type SessionExerciseSummary } from "@/server/schedule";
import { EMPTY_HABITS, type HabitState } from "@/components/HabitRow";
import { CONSISTENCY_WINDOW_DAYS } from "@/domain/consistency";
import type { Profile } from "@/lib/types";

export interface TodayData {
  position: SchedulePosition;
  exercises: SessionExerciseSummary[];
  habits: HabitState;
  streak: Consistency;
  daysToCheckin: number | null;
  unread: number;
  blockLabel: string | null;
  weekday: string;
}

/**
 * Everything the Today screen shows, assembled once.
 *
 * Lives here rather than in the page so the client's own screen and the coach's preview
 * are guaranteed to be looking at the same numbers — a preview that computes its own
 * version of "week 6 of 12" is exactly the drift this architecture exists to prevent.
 */
export async function loadToday(
  client: SupabaseClient,
  profile: Profile,
  today: string,
): Promise<TodayData> {
  const windowStart = new Date(`${today}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - (CONSISTENCY_WINDOW_DAYS - 1));

  const [schedule, { data: habitRows }, { data: engagementRow }, { count: unread }] =
    await Promise.all([
      loadSchedule(client, profile.id),
      client
        .from("habit_days")
        .select("local_date, protein, steps, water, sleep")
        .eq("profile_id", profile.id)
        .gte("local_date", windowStart.toISOString().slice(0, 10))
        .order("local_date", { ascending: false }),
      client
        .from("client_engagements")
        .select("*")
        .eq("profile_id", profile.id)
        .in("status", ["pending", "active", "past_due"])
        .maybeSingle(),
      client
        .from("coach_notes")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .eq("author", "coach")
        .eq("read", false),
    ]);

  const days = (habitRows ?? []) as HabitDay[];
  const engagement = (engagementRow as Engagement | null) ?? null;
  const asDate = parseISO(`${today}T12:00:00Z`);

  const position = schedulePosition(schedule.assignment, schedule.sessions, today);
  const exercises = position.session ? await loadSessionExercises(client, position.session.id) : [];

  const engagementAt = engagementPosition(engagement, asDate);
  const checkinDue = nextCheckinDue(engagement, asDate);

  const todayRow = days.find((d) => d.local_date === today);
  const habits: HabitState = todayRow
    ? { protein: todayRow.protein, steps: todayRow.steps, water: todayRow.water, sleep: todayRow.sleep }
    : EMPTY_HABITS;

  return {
    position,
    exercises,
    habits,
    streak: consistency(days, today, engagement?.starts_on ?? schedule.assignment?.starts_on),
    daysToCheckin: checkinDue ? differenceInCalendarDays(checkinDue, asDate) : null,
    unread: unread ?? 0,
    // The engagement is the coaching container, so it names the week when there is one.
    // An open-ended comp arrangement has no total, so it falls back to the training block.
    blockLabel:
      engagementAt.label ??
      (position.calendarWeek && position.totalWeeks
        ? `Week ${Math.min(position.calendarWeek, position.totalWeeks)} of ${position.totalWeeks}`
        : null),
    weekday: new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }),
  };
}
