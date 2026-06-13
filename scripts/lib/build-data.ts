import type {
  RepoDetails,
  Snapshot,
  StarHistoryPoint,
} from '../../src/lib/types';
import { calculateStarDelta, classifyActivity } from '../../src/lib/activity';

const MAX_STAR_HISTORY_POINTS = 90;
const DAILY_SNAPSHOT_RETENTION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function deriveStarHistory(
  repoId: string,
  snapshots: Snapshot[],
): StarHistoryPoint[] {
  const points = snapshots
    .filter((snapshot) => snapshot.repos[repoId] !== undefined)
    .map((snapshot) => ({
      date: snapshot.date,
      stars: snapshot.repos[repoId].stars,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return sampleHistoryPoints(points, MAX_STAR_HISTORY_POINTS);
}

export function applySnapshotHistory(
  repo: RepoDetails,
  snapshots: Snapshot[],
  now = new Date(),
): RepoDetails {
  const starDelta7d = calculateStarDelta(repo.id, repo.stars, snapshots, now);

  return {
    ...repo,
    starDelta7d,
    starHistory: deriveStarHistory(repo.id, snapshots),
    activity: classifyActivity(repo, snapshots, now),
  };
}

export function downsampleSnapshots(
  snapshots: Snapshot[],
  now = new Date(),
): Snapshot[] {
  const cutoffTime =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    DAILY_SNAPSHOT_RETENTION_DAYS * MS_PER_DAY;
  const weeklyOlderSnapshots = new Map<string, Snapshot>();
  const retainedSnapshots: Snapshot[] = [];

  for (const snapshot of snapshots.toSorted((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    const snapshotTime = Date.parse(`${snapshot.date}T00:00:00Z`);

    if (!Number.isFinite(snapshotTime)) {
      continue;
    }

    if (snapshotTime >= cutoffTime) {
      retainedSnapshots.push(snapshot);
      continue;
    }

    weeklyOlderSnapshots.set(isoWeekKey(new Date(snapshotTime)), snapshot);
  }

  return [...weeklyOlderSnapshots.values(), ...retainedSnapshots].toSorted(
    (a, b) => a.date.localeCompare(b.date),
  );
}

function isoWeekKey(date: Date): string {
  const day = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7,
  );

  return `${thursday.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function sampleHistoryPoints(
  points: StarHistoryPoint[],
  maxPoints: number,
): StarHistoryPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const lastIndex = points.length - 1;
  const selectedIndexes = new Set<number>();

  for (let index = 0; index < maxPoints; index += 1) {
    selectedIndexes.add(Math.round((index * lastIndex) / (maxPoints - 1)));
  }

  let cursor = lastIndex;

  while (selectedIndexes.size < maxPoints && cursor >= 0) {
    selectedIndexes.add(cursor);
    cursor -= 1;
  }

  return [...selectedIndexes]
    .toSorted((a, b) => a - b)
    .map((index) => points[index]);
}
