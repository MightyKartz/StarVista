import type { ManifestRepo, Snapshot } from './types';

export type TrendView = 'all' | 'rising' | 'new-today';

export interface TrendViewOptions {
  view: TrendView;
  firstSeenDates: Record<string, string>;
  today: string;
}

export function deriveRepoFirstSeenDates(
  snapshots: Snapshot[],
): Record<string, string> {
  const firstSeenDates: Record<string, string> = {};

  for (const snapshot of snapshots.toSorted((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    for (const repoId of Object.keys(snapshot.repos)) {
      firstSeenDates[repoId] ??= snapshot.date;
    }
  }

  return firstSeenDates;
}

export function filterReposForTrendView(
  repos: ManifestRepo[],
  options: TrendViewOptions,
): ManifestRepo[] {
  if (options.view === 'rising') {
    return repos
      .filter((repo) => repo.activity === 'fast-rising')
      .toSorted(compareByStarDelta);
  }

  if (options.view === 'new-today') {
    return repos.filter(
      (repo) => options.firstSeenDates[repo.id] === options.today,
    );
  }

  return repos;
}

export function compareByStarDelta(a: ManifestRepo, b: ManifestRepo): number {
  const deltaA = a.starDelta7d ?? Number.NEGATIVE_INFINITY;
  const deltaB = b.starDelta7d ?? Number.NEGATIVE_INFINITY;

  if (deltaA === deltaB) {
    return b.stars - a.stars;
  }

  return deltaB - deltaA;
}
