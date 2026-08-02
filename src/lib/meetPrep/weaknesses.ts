export interface WeaknessOption {
  key: string;
  label: string;
}

export const BENCH_WEAKNESS_OPTIONS: WeaknessOption[] = [
  { key: "off_chest", label: "Weak off the chest" },
  { key: "mid_range", label: "Weak through the middle range" },
  { key: "lockout", label: "Weak at lockout" },
  { key: "pause_strength", label: "Poor pause strength" },
  { key: "upper_back_stability", label: "Poor upper-back stability" },
  { key: "shoulder_stability", label: "Poor shoulder stability" },
  { key: "triceps", label: "Weak triceps" },
  { key: "bar_path", label: "Inconsistent bar path" },
  { key: "leg_drive", label: "Loss of leg drive" },
  { key: "command", label: "Poor competition command execution" },
];

export const DEADLIFT_WEAKNESS_OPTIONS: WeaknessOption[] = [
  { key: "floor", label: "Weak from the floor" },
  { key: "below_knee", label: "Loses position below the knee" },
  { key: "mid_range", label: "Slow through the middle range" },
  { key: "lockout", label: "Weak at lockout" },
  { key: "bracing", label: "Poor bracing" },
  { key: "lower_back", label: "Weak lower back" },
  { key: "hamstrings", label: "Weak hamstrings" },
  { key: "glutes", label: "Weak glutes" },
  { key: "hip_stability", label: "Poor hip stability" },
  { key: "lat_engagement", label: "Poor lat engagement" },
  { key: "setup", label: "Inconsistent setup" },
  { key: "command", label: "Poor competition command execution" },
];
