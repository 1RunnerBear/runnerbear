export function referencesWorkout(row, workout) {
  const payload = row?.payload || {};
  const id = payload.workoutId || row?.workoutId;
  const revision = payload.planRevisionId || row?.planRevisionId;
  return Boolean(id && id === workout?.workoutId &&
    (!revision || !workout.planRevisionId || revision === workout.planRevisionId));
}

export function hasExecutionEvidence(workout, activities) {
  if (workout.status === 'completed') return true;
  return workout.status === 'scheduled' && activities.some(row =>
    referencesWorkout(row, workout) && row.date === workout.localDate);
}
