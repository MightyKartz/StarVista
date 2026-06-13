import { describe, expect, it } from 'vitest';
import { mergeManifestRepos } from '../scripts/lib/manifest';
import type { ManifestRepo } from '../src/lib/types';

const baseRepo: ManifestRepo = {
  id: 'owner/base',
  slug: 'owner-base',
  owner: 'owner',
  name: 'base',
  description: 'Base repo',
  archived: false,
  primaryLanguage: 'TypeScript',
  languageColor: '#3178c6',
  stars: 100,
  forks: 10,
  openIssues: 1,
  pushedAt: '2026-06-13T00:00:00Z',
  topics: [],
  license: 'MIT',
  activity: 'active',
  starDelta7d: null,
  ownerAvatarUrl: null,
};

function repo(overrides: Partial<ManifestRepo>): ManifestRepo {
  return { ...baseRepo, ...overrides };
}

describe('mergeManifestRepos', () => {
  it('keeps current search results first and appends historical repositories missing from the latest search', () => {
    const currentRepos = [
      repo({ id: 'owner/current', slug: 'owner-current', stars: 500 }),
      repo({ id: 'owner/overlap', slug: 'owner-overlap', stars: 400 }),
    ];
    const existingRepos = [
      repo({ id: 'owner/overlap', slug: 'owner-overlap', stars: 300 }),
      repo({ id: 'owner/historical', slug: 'owner-historical', stars: 200 }),
    ];

    expect(mergeManifestRepos(currentRepos, existingRepos)).toEqual([
      currentRepos[0],
      currentRepos[1],
      existingRepos[1],
    ]);
  });
});
