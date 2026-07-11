export const BOMB_MILESTONES = [3, 7, 12, 18, 25, 35, 45, 55];
export const INTEL_MILESTONES = [5, 15, 30, 45];

// Progress (0..1) through the current leg toward the next milestone, plus
// which milestone is next (null once every milestone has been passed).
export function milestoneProgress(streakDays, milestones) {
  let prev = 0;
  let next = null;

  for (const m of milestones) {
    if (streakDays >= m) {
      prev = m;
    } else {
      next = m;
      break;
    }
  }

  if (next === null) {
    return { fraction: 1, next: null, prev };
  }

  const span = next - prev;
  const progressed = streakDays - prev;
  return { fraction: Math.min(1, Math.max(0, progressed / span)), next, prev };
}
