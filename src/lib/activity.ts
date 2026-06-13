import type { Activity, Snapshot } from './types';

export const ACTIVE_PUSH_DAYS = 14;
export const STABLE_PUSH_DAYS = 90;
export const FAST_RISING_LOOKBACK_DAYS = 7;
export const FAST_RISING_ABSOLUTE_STARS = 300;
export const FAST_RISING_PERCENT = 0.03;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ActivityInput {
  id: string;
  archived: boolean;
  stars: number;
  pushedAt: string | null;
}

export function classifyActivity(
  repo: ActivityInput,
  snapshots: Snapshot[] = [],
  now = new Date(),
): Activity {
  if (repo.archived) {
    return 'archived';
  }

  const starDelta7d = calculateStarDelta(repo.id, repo.stars, snapshots, now);
  const fastRisingThreshold = Math.max(
    FAST_RISING_ABSOLUTE_STARS,
    repo.stars * FAST_RISING_PERCENT,
  );

  if (starDelta7d !== null && starDelta7d >= fastRisingThreshold) {
    return 'fast-rising';
  }

  const pushedAgeDays = daysSince(repo.pushedAt, now);

  if (pushedAgeDays !== null && pushedAgeDays <= ACTIVE_PUSH_DAYS) {
    return 'active';
  }

  if (pushedAgeDays !== null && pushedAgeDays <= STABLE_PUSH_DAYS) {
    return 'stable';
  }

  return 'cooling';
}

export function calculateStarDelta(
  repoId: string,
  currentStars: number,
  snapshots: Snapshot[],
  now = new Date(),
): number | null {
  const targetTime = now.getTime() - FAST_RISING_LOOKBACK_DAYS * MS_PER_DAY;
  const baseline = snapshots
    .filter((snapshot) => snapshot.repos[repoId] !== undefined)
    .map((snapshot) => ({
      time: Date.parse(`${snapshot.date}T00:00:00Z`),
      stars: snapshot.repos[repoId].stars,
    }))
    .filter((point) => Number.isFinite(point.time) && point.time <= targetTime)
    .sort((a, b) => b.time - a.time)[0];

  return baseline ? currentStars - baseline.stars : null;
}

function daysSince(date: string | null, now: Date): number | null {
  if (!date) {
    return null;
  }

  const time = Date.parse(date);

  if (!Number.isFinite(time)) {
    return null;
  }

  return (now.getTime() - time) / MS_PER_DAY;
}
