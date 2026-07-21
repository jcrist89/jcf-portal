export type Role = "coach" | "client";
export type Goal = "strength_gain" | "fat_loss" | "hybrid" | "powerlifting";

export interface Profile {
  id: string;
  role: Role;
  username: string;
  pin_hash: string;
  full_name: string | null;
  birthday: string | null;
  height_in: number | null;
  starting_weight: number | null;
  current_weight: number | null;
  goal: Goal | null;
  program_id: string | null;
  is_active: boolean;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export type PublicProfile = Omit<Profile, "pin_hash">;

export interface Exercise {
  name: string;
  sets: number | string;
  reps: string;
  rest: string;
  notes?: string;
  liftKey?: string;      // add this line — links to training_maxes.lift, e.g. "bench"
  percentOfTm?: number;  // add this line — e.g. 87 means 87% of that lift's training max
}

export interface TrainingMax {
  id: string;
  profile_id: string;
  lift: string;
  weight: number;
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

export interface Program {
  id: string;
  goal: Goal;
  name: string;
  description: string | null;
  structure: ProgramStructure;
  is_template: boolean;
  client_id: string | null;
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

export type Lift = "squat" | "bench" | "deadlift" | "overhead_press" | string;

export interface PR {
  id: string;
  profile_id: string;
  lift: Lift;
  weight: number;
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
  sets: SetLog[];
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

export interface SessionUser {
  id: string;
  username: string;
  role: Role;
  fullName: string | null;
}
