import Link from "next/link";
import { HabitRow, type HabitState } from "@/components/HabitRow";
import type { SchedulePosition } from "@/domain/schedule";
import type { Consistency } from "@/domain/consistency";
import type { SessionExerciseSummary } from "@/server/schedule";

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
  checkinOverdue = false,
  unread,
  nutritionTargets,
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
  checkinOverdue?: boolean;
  unread: number;
  nutritionTargets?: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };
  viewOnly?: boolean;
}) {
  return (
    <>
      <header className="mb-6">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-jcf-gray">
          {viewOnly ? "Client view" : weekday}
          {blockLabel && <span className="text-jcf-blue"> · {blockLabel}</span>}
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-jcf-gray">{viewOnly ? "Today for" : "Today"}</p>
            <h1 className="font-display text-4xl uppercase leading-none tracking-wide text-white">{firstName}</h1>
          </div>
          {!viewOnly && unread > 0 && (
            <Link
              href="/messages"
              className="rounded-full border border-jcf-blue/30 bg-jcf-blue/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-jcf-blue"
            >
              {unread} new
            </Link>
          )}
        </div>
      </header>

      <section className="relative mb-6 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-jcf-panel via-jcf-panel to-jcf-charcoal p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-jcf-blue/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-14 left-6 h-32 w-32 rounded-full bg-jcf-gold/10 blur-3xl" />
        {position.session ? (
          <div className="relative">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-jcf-gold">
                  {position.dueToday ? "Today's training" : "Next training"}
                </p>
                <h2 className="font-display text-3xl uppercase leading-none tracking-wide text-white">
                  {position.session.label}
                </h2>
                <p className="mt-2 text-xs text-jcf-gray">
                  {exercises.length} exercise{exercises.length === 1 ? "" : "s"}
                  {position.session.scheduled_local_date && !position.dueToday && (
                    <> · scheduled {position.session.scheduled_local_date}</>
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-jcf-black/35 px-3 py-2 text-center">
                <div className="font-display text-xl text-white">{exercises.length}</div>
                <div className="text-[8px] font-semibold uppercase tracking-wider text-jcf-gray">Moves</div>
              </div>
            </div>

            {exercises.length > 0 && (
              <div className="mb-5 rounded-2xl border border-white/8 bg-jcf-black/25 px-4 py-3">
                <ul className="space-y-1.5 text-sm text-jcf-gray">
                  {exercises.slice(0, 3).map((ex, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="truncate text-white/90">{ex.name}</span>
                      {ex.sets && ex.reps && <span className="shrink-0 text-xs text-jcf-gray">{ex.sets}×{ex.reps}</span>}
                    </li>
                  ))}
                </ul>
                {exercises.length > 3 && (
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-jcf-gray">+ {exercises.length - 3} more</p>
                )}
              </div>
            )}

            {viewOnly ? (
              <span className="block w-full cursor-not-allowed rounded-xl bg-white/8 px-5 py-3 text-center text-sm font-semibold uppercase tracking-wide text-jcf-gray">
                Start workout unavailable in preview
              </span>
            ) : (
              <Link
                href="/program"
                className="block w-full rounded-xl bg-jcf-gold px-5 py-3.5 text-center text-sm font-bold uppercase tracking-wide text-jcf-black transition-all hover:brightness-105 active:translate-y-px"
              >
                {position.dueToday ? "Start workout" : "Preview session"}
              </Link>
            )}
          </div>
        ) : (
          <div className="relative">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-jcf-blue">
              {position.complete ? "Block complete" : "Recovery day"}
            </p>
            <h2 className="font-display text-3xl uppercase leading-none tracking-wide text-white">
              {position.complete ? "Work Done." : "Recover On Purpose."}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-jcf-gray">
              {position.complete
                ? "Jon will have your next block ready shortly."
                : position.totalWeeks > 0
                ? "Nothing is scheduled today. Hit the basics, recover, and come back ready."
                : "No program assigned yet. Jon is setting yours up."}
            </p>
          </div>
        )}
      </section>

      {position.sessionsBehind > 0 && (
        <div className="mb-6 rounded-2xl border border-jcf-gold/30 bg-jcf-gold/8 p-4 text-sm text-jcf-gold">
          {viewOnly ? "They're" : "You're"} {position.sessionsBehind} session
          {position.sessionsBehind === 1 ? "" : "s"} behind. Nothing is lost. Pick up where you left off.
        </div>
      )}

      {nutritionTargets?.calories != null && (
        <section className="mb-6 rounded-[20px] border border-white/10 bg-jcf-panel/80 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-jcf-gray">Today's targets</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl text-jcf-gold">{nutritionTargets.calories}</span>
                <span className="text-xs text-jcf-gray">calories</span>
              </div>
            </div>
            {!viewOnly && (
              <Link href="/nutrition" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-jcf-blue">
                Log food →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Protein", nutritionTargets.protein],
              ["Carbs", nutritionTargets.carbs],
              ["Fat", nutritionTargets.fat],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-jcf-black/30 px-2 py-2.5 text-center">
                <div className="font-display text-xl text-white">{value ?? "—"}{value != null ? "g" : ""}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-jcf-gray">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <HabitRow initial={habits} localDate={localDate} readOnly={viewOnly} />

      <section className="grid grid-cols-3 gap-2 rounded-[20px] border border-white/10 bg-jcf-panel/55 p-3">
        <div className="rounded-xl bg-jcf-black/25 px-2 py-3 text-center">
          <div className="font-display text-2xl text-jcf-gold">{streak.daysHit}</div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-jcf-gray">of {streak.windowDays} days</div>
        </div>
        <Link href={viewOnly ? "#" : "/checkin"} className="rounded-xl bg-jcf-black/25 px-2 py-3 text-center">
          <div className={`font-display text-2xl ${checkinOverdue ? "text-jcf-danger" : "text-white"}`}>
            {checkinOverdue ? "Due" : daysToCheckin == null ? "—" : daysToCheckin === 0 ? "Today" : `${daysToCheckin}d`}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-jcf-gray">Check-in</div>
        </Link>
        <Link href={viewOnly ? "#" : "/messages"} className="rounded-xl bg-jcf-black/25 px-2 py-3 text-center">
          <div className={`font-display text-2xl ${unread ? "text-jcf-blue" : "text-white"}`}>{unread}</div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-jcf-gray">Messages</div>
        </Link>
      </section>

      {position.adherence.pct != null && (
        <p className="mt-4 text-center text-xs text-jcf-gray">
          {position.adherence.completed + position.adherence.scaled} of {position.adherence.accountedFor} scheduled sessions completed this block.
        </p>
      )}
    </>
  );
}
