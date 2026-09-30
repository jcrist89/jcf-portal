export type SetResultInput = { reps: string; weight: string };

export type RestTimerStartState = {
  shouldStart: boolean;
  hasStarted: boolean;
};

function isEnteredNumber(value: string): boolean {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

export function restTimerStartState(
  set: SetResultInput,
  hasStarted: boolean,
): RestTimerStartState {
  const reps = Number(set.reps);
  const weight = Number(set.weight);
  const complete =
    isEnteredNumber(set.reps) &&
    reps > 0 &&
    isEnteredNumber(set.weight) &&
    weight >= 0;

  return {
    shouldStart: complete && !hasStarted,
    hasStarted: complete,
  };
}
