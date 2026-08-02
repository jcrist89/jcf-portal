import type { DeviationReport, Program, ReadinessCheckin, WorkoutLog } from "../types";

export interface ComplianceInput {
  program: Program | null;
  logs: WorkoutLog[];
  deviations: DeviationReport[];
  readiness: ReadinessCheckin[];
  week: number;
}

export type ComplianceCategory = "Excellent" | "Acceptable" | "Needs Improvement" | "Coach Review Required";

export interface ComplianceResult {
  week: number;
  score: number;
  category: ComplianceCategory;
}

function categoryFor(score: number): ComplianceCategory {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Acceptable";
  if (score >= 70) return "Needs Improvement";
  return "Coach Review Required";
}

// Computed on demand from workout_logs/deviation_reports/readiness_checkins rather
// than stored, mirroring how clientSummary.ts derives streaks on the fly.
export function computeWeeklyCompliance({ program, logs, deviations, readiness, week }: ComplianceInput): ComplianceResult {
  const weekPrefix = `Week ${week} `;
  // Scope to logs against THIS program — day_label text ("Week 1 — ...") is reused
  // across every program, so without the program_id check a log from an old/archived
  // program with the same week number would bleed into this program's score.
  const weekLogs = logs.filter(
    (l) => l.completed && l.program_id === program?.id && l.day_label?.startsWith(weekPrefix)
  );
  const weekDeviations = deviations.filter((d) => d.week_number === week && !d.reviewed);

  const plannedDays = (program?.structure?.weeks?.find((w) => w.week === week)?.days ?? []).filter(
    (d) => !d.label.toLowerCase().includes("rest")
  );

  if (plannedDays.length === 0) {
    return { week, score: 100, category: "Excellent" };
  }

  let score = 100;
  const missedDays = Math.max(0, plannedDays.length - weekLogs.length);
  score -= missedDays * 10;
  score -= weekDeviations.length * 15;

  const missingReadiness = weekLogs.filter((l) => !readiness.some((r) => r.date === l.date)).length;
  score -= missingReadiness * 5;

  if (weekLogs.length === 0) score = 0;

  score = Math.max(0, Math.min(100, score));
  return { week, score, category: categoryFor(score) };
}
