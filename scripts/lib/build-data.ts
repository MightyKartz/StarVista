import type {
  RepoDetails,
  Snapshot,
  StarHistoryPoint,
} from '../../src/lib/types';
import { calculateStarDelta, classifyActivity } from '../../src/lib/activity';

const MAX_STAR_HISTORY_POINTS = 90;

export function deriveStarHistory(
  repoId: string,
  snapshots: Snapshot[],
): StarHistoryPoint[] {
  return snapshots
    .filter((snapshot) => snapshot.repos[repoId] !== undefined)
    .map((snapshot) => ({
      date: snapshot.date,
      stars: snapshot.repos[repoId].stars,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_STAR_HISTORY_POINTS);
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
