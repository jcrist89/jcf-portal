import Link from "next/link";
import { HabitRow, type HabitState } from "@/components/HabitRow";
import type { SchedulePosition } from "@/domain/schedule";
import type { Consistency } from "@/domain/consistency";
import type { SessionExerciseSummary } from "@/server/schedule";

/**
 * The Today screen, presentational.
 *
 * Shared by the client's own screen and the coach's "what does he see" preview, so the
 * preview cannot drift into showing a layout no client has. `viewOnly` disables the two
 * interactive elements — starting a session and tapping a habit — since a coach looking
 * at a client's day should not be one tap away from logging habits as them.
 */
export function TodayView({
  firstName,
  weekday,
  blockLabel,
  position,
  exercises,
  habits,
  localDate,
  streak,
  daysToCheckin,
  unread,
  viewOnly = false,
}: {
  firstName: string;
  weekday: string;
  blockLabel: string | null;
  position: SchedulePosition;
  exercises: SessionExerciseSummary[];
  habits: HabitState;
  localDate: string;
  streak: Consistency;
  daysToCheckin: number | null;
  unread: number;
  viewOnly?: boolean;
}) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-[0.2em] text-jcf-gray mb-1">
        {viewOnly ? "Viewing" : weekday}
        {blockLabel && <span className="text-jcf-gold"> · {blockLabel}</span>}
      </p>
      <h1 className="font-display text-2xl uppercase tracking-wide mb-6">{firstName}</h1>

      {/* One action, or an explicit rest day. Never a blank screen. */}
      <section className="bg-jcf-panel border border-white/10 rounded-sm p-5 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-diagonal-fade" aria-hidden="true" />
        {position.session ? (
          <>
            <div className="text-jcf-gold text-xs uppercase tracking-widest mb-1">
              {position.dueToday ? "Today's session" : "Next session"}
            </div>
            <div className="font-display text-xl uppercase mb-1">{position.session.label}</div>
            <p className="text-jcf-gray text-xs mb-4">
              {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
              {position.session.scheduled_local_date && !position.dueToday && (
                <> · scheduled {position.session.scheduled_local_date}</>
              )}
            </p>
            <ul className="text-sm text-jcf-gray space-y-1 mb-5">
              {exercises.slice(0, 3).map((ex, i) => (
                <li key={i}>
                  {ex.name}
                  {ex.sets && ex.reps ? ` — ${ex.sets}x${ex.reps}` : ""}
                </li>
              ))}
              {exercises.length > 3 && <li>+ {exercises.length - 3} more</li>}
            </ul>
            {viewOnly ? (
              <span className="inline-block w-full text-center bg-white/10 text-jcf-gray uppercase text-sm px-5 py-3 rounded-sm cursor-not-allowed">
                Start workout (not available in preview)
              </span>
            ) : (
              <Link
                href="/program"
                className="inline-block bg-jcf-gold text-jcf-black uppercase text-sm font-semibold px-5 py-3 rounded-sm w-full text-center"
              >
                {position.dueToday ? "Start workout" : "Preview session"}
              </Link>
            )}
          </>
        ) : (
          <>
            <div className="text-jcf-gold text-xs uppercase tracking-widest mb-1">
              {position.complete ? "Block complete" : "Rest day"}
            </div>
            <p className="text-jcf-gray text-sm">
              {position.complete
                ? "Nice work — Jon will have your next block ready shortly."
                : position.totalWeeks > 0
                ? "Nothing scheduled today. Recovery is part of the program."
                : "No program assigned yet — Jon is setting yours up."}
            </p>
          </>
        )}
      </section>

      {position.sessionsBehind > 0 && (
        <div className="rounded-sm p-3 mb-6 text-sm border bg-jcf-gold/10 border-jcf-gold/40 text-jcf-gold">
          {viewOnly ? "They're" : "You're"} {position.sessionsBehind} session
          {position.sessionsBehind === 1 ? "" : "s"} behind where this block expected{" "}
          {viewOnly ? "them" : "you"}. Nothing is lost — pick up right where you left off.
        </div>
      )}

      <HabitRow initial={habits} localDate={localDate} readOnly={viewOnly} />

      <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
        <div>
          <div className="font-display text-lg text-jcf-gold">{streak.daysHit}</div>
          <div className="text-[10px] uppercase tracking-wider text-jcf-gray">
            of last {streak.windowDays} days
          </div>
        </div>
        <div>
          <div className="font-display text-lg">
            {daysToCheckin == null ? "—" : daysToCheckin === 0 ? "Today" : `${daysToCheckin}d`}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-jcf-gray">Check-in</div>
        </div>
        <div>
          <div className={`font-display text-lg ${unread ? "text-jcf-gold" : ""}`}>{unread}</div>
          <div className="text-[10px] uppercase tracking-wider text-jcf-gray">Unread</div>
        </div>
      </div>

      {position.adherence.pct != null && (
        <p className="text-jcf-gray text-xs text-center mt-4">
          {position.adherence.completed + position.adherence.scaled} of{" "}
          {position.adherence.accountedFor} scheduled sessions done this block.
        </p>
      )}
    </>
  );
}
