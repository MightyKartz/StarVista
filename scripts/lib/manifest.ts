import type { ManifestRepo } from '../../src/lib/types';

export function mergeManifestRepos(
  currentRepos: ManifestRepo[],
  existingRepos: ManifestRepo[],
): ManifestRepo[] {
  const currentIds = new Set(currentRepos.map((repo) => repo.id));
  const historicalRepos = existingRepos.filter(
    (repo) => !currentIds.has(repo.id),
  );

  return [...currentRepos, ...historicalRepos];
}
