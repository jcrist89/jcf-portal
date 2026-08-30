export type Role = "coach" | "client";
export type Goal = "strength_gain" | "fat_loss" | "hybrid" | "powerlifting";
export type ScheduleMode = "sequential" | "date_anchored";
export type Tier = "free" | "paid_programming" | "paid_coaching";
export type SubscriptionStatus = "active" | "past_due" | "canceled" | "n/a";

export interface Profile {
  id: string;
  role: Role;
  username: string | null;
  email: string | null;
  full_name: string | null;
  birthday: string | null;
  height_in: number | null;
  starting_weight: number | null;
  current_weight: number | null;
  goal: Goal | null;
  program_id: string | null;
  tier: Tier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  timezone: string;
  is_active: boolean;
  onboarded: boolean;
  welcome_email_sent_at: string | null;
  last_nudge_threshold: number | null;
  created_at: string;
  updated_at: string;
}

export type PublicProfile = Profile;

export interface Exercise {
  name: string;
  /** Stable catalog identity. Renaming `name` must not change this. */
  exerciseId?: string;
  sets: number | string;
  reps: string;
  rest: string;
  notes?: string;
  liftKey?: string;      // add this line — links to training_maxes.lift, e.g. "bench"
  percentOfTm?: number;  // add this line — e.g. 87 means 87% of that lift's training max
  targetRpe?: string;    // e.g. "7-7.5" — display only
  rpeCap?: number;       // e.g. 8 — the max RPE this set should be taken to
  unit?: "kg" | "lb";    // rounding/display unit for liftKey-driven exercises; defaults to "lb"
}

export interface TrainingMax {
  id: string;
  profile_id: string;
  lift: string;
  weight: number;
  one_rm: number | null;
  unit: "kg" | "lb";
  tm_percent: number | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ProgramDay {
  day: number;
  label: string;
  exercises: Exercise[];
}

export interface ProgramWeek {
  week: number;
  note?: string;
  days: ProgramDay[];
}

export interface ProgramStructure {
  weeks: ProgramWeek[];
}

export interface AttemptEntry {
  opener: number | null;
  second: number | null;
  third: number | null;
}

export interface AttemptPlan {
  bench: AttemptEntry;
  deadlift: AttemptEntry;
  released: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ProgramWeaknesses {
  bench: string[];
  deadlift: string[];
}

export interface Program {
  id: string;
  goal: Goal;
  name: string;
  description: string | null;
  structure: ProgramStructure;
  is_template: boolean;
  is_default_template: boolean;
  client_id: string | null;
  starts_on: string | null;
  schedule_mode: ScheduleMode;
  meet_date: string | null;
  attempt_plan: AttemptPlan | null;
  weaknesses: ProgramWeaknesses | null;
  created_at: string;
  updated_at: string;
}

export interface Measurement {
  id: string;
  profile_id: string;
  date: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
  notes: string | null;
  created_at: string;
}

export type MovementPattern =
  | "squat" | "hinge" | "push_horizontal" | "push_vertical"
  | "pull_horizontal" | "pull_vertical" | "lunge" | "carry"
  | "core" | "conditioning" | "accessory";

/** A row in the exercise catalog — the stable identity behind every prescription and log. */
export interface CatalogExercise {
  id: string;
  slug: string;
  name: string;
  movement_pattern: MovementPattern | null;
  default_unit: "kg" | "lb";
  demo_url: string | null;
  coach_cue: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Lift = "squat" | "bench" | "deadlift" | "overhead_press" | string;

export interface PR {
  id: string;
  profile_id: string;
  lift: Lift;
  weight: number;
  unit: "kg" | "lb";
  reps: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface SetLog {
  reps: number | null;
  weight: number | null;
  rpe: number | null;
}

export interface ExerciseLog {
  name: string;
  /** Stable catalog identity, copied from the prescription at log time. */
  exerciseId?: string;
  sets: SetLog[];
  unit?: "kg" | "lb"; // unit the weights were logged in; defaults to "lb" when absent
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  profile_id: string;
  program_id: string | null;
  date: string;
  day_label: string | null;
  exercises_completed: ExerciseLog[];
  completed: boolean;
  created_at: string;
}

export type AchievementType =
  | "first_workout"
  | "streak_4_weeks"
  | "streak_8_weeks"
  | "workouts_10"
  | "workouts_25"
  | "workouts_50"
  | "pr_hit"
  | "first_checkin_30_days"
  | "goal_milestone";

export interface Achievement {
  id: string;
  profile_id: string;
  type: AchievementType | string;
  title: string;
  description: string | null;
  date_earned: string;
  icon: string | null;
  created_at: string;
}

export interface CoachNote {
  id: string;
  profile_id: string;
  author: "coach" | "client";
  message: string;
  read: boolean;
  created_at: string;
}

export type ReadinessTier = "high" | "moderate" | "low" | "very_low";

export interface ReadinessCheckin {
  id: string;
  profile_id: string;
  date: string;
  sleep: number;
  fatigue: number;
  soreness: number;
  joint_pain: number;
  stress: number;
  motivation: number;
  nutrition: number;
  confidence: number;
  score: number;
  tier: ReadinessTier;
  created_at: string;
}

export type JokerStatus = "pending" | "approved" | "denied" | "completed" | "failed_compliance";

export interface JokerRequest {
  id: string;
  profile_id: string;
  program_id: string | null;
  week_number: number;
  lift: "meet_bench" | "meet_deadlift";
  top_single_weight: number;
  top_single_rpe: number;
  max_permitted_weight: number;
  status: JokerStatus;
  coach_response: string | null;
  actual_weight: number | null;
  actual_rpe: number | null;
  technical_result: string | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export type AssignmentStatus = "active" | "superseded" | "completed" | "abandoned";
export type SessionStatus =
  | "prescribed" | "in_progress" | "completed" | "scaled" | "skipped" | "superseded";
export type ScalingMode = "rough_shift" | "no_equipment" | "short_on_time";

/** A client's program, anchored to a calendar and expanded into real sessions. */
export interface ProgramAssignment {
  id: string;
  profile_id: string;
  program_id: string;
  engagement_id: string | null;
  starts_on: string;
  timezone: string;
  schedule_mode: ScheduleMode;
  weekday_pattern: number[] | null;
  status: AssignmentStatus;
  superseded_by: string | null;
  materialized_at: string | null;
  /** programs.updated_at when sessions were last built — lets staleness be detected. */
  source_updated_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One prescribed session, with a date and a status. */
export interface AssignmentSession {
  id: string;
  assignment_id: string;
  profile_id: string;
  week_number: number;
  day_number: number;
  /** Flat position across the block, so "next undone" is an ordering. */
  sequence: number;
  scheduled_local_date: string | null;
  label: string | null;
  status: SessionStatus;
  scaling_mode: ScalingMode | null;
  scaling_reason: string | null;
  workout_log_id: string | null;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
}

/** The prescription for one exercise within a session, snapshotted at assignment time. */
export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  /** 1 = keep under Short on Time, 3 = first to drop. */
  priority: number;
  prescribed_sets: string | null;
  prescribed_reps: string | null;
  rest: string | null;
  percent_of_tm: number | null;
  rpe_cap: number | null;
  target_rpe: string | null;
  unit: "kg" | "lb" | null;
  lift_key: string | null;
  coach_note: string | null;
  substitute_exercise_id: string | null;
  scaled_sets: string | null;
  scaled_reps: string | null;
  created_at: string;
}

export type FormDraftType = "workout" | "measurement" | "pr";

export interface FormDraft {
  id: string;
  profile_id: string;
  form_type: FormDraftType;
  draft_key: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DeviationReport {
  id: string;
  profile_id: string;
  workout_log_id: string | null;
  exercise_name: string;
  lift_key: string | null;
  week_number: number | null;
  prescribed_weight: number | null;
  actual_weight: number;
  reason: string | null;
  actual_rpe: number | null;
  pain_score: number | null;
  technical_rating: number | null;
  reviewed: boolean;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  role: Role;
  fullName: string | null;
  tier: Tier;
  onboarded: boolean;
  timezone: string;
}
