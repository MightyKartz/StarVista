import { describe, expect, it } from 'vitest';
import {
  compareByStarDelta,
  deriveRepoFirstSeenDates,
  filterReposForTrendView,
} from '../src/lib/trends';
import type { ManifestRepo, Snapshot } from '../src/lib/types';

const baseRepo: ManifestRepo = {
  id: 'owner/base',
  slug: 'owner-base',
  owner: 'owner',
  name: 'base',
  description: 'Base repo',
  archived: false,
  primaryLanguage: 'TypeScript',
  languageColor: '#3178c6',
  stars: 1_000,
  forks: 100,
  openIssues: 10,
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

describe('deriveRepoFirstSeenDates', () => {
  it('records the earliest snapshot date where each repository appears', () => {
    const snapshots: Snapshot[] = [
      {
        date: '2026-06-12',
        repos: {
          'owner/old': { stars: 10, forks: 1, openIssues: 0 },
          'owner/new': { stars: 20, forks: 2, openIssues: 0 },
        },
      },
      {
        date: '2026-06-13',
        repos: {
          'owner/new': { stars: 25, forks: 2, openIssues: 0 },
          'owner/today': { stars: 5, forks: 0, openIssues: 0 },
        },
      },
    ];

    expect(deriveRepoFirstSeenDates(snapshots)).toEqual({
      'owner/new': '2026-06-12',
      'owner/old': '2026-06-12',
      'owner/today': '2026-06-13',
    });
  });
});

describe('filterReposForTrendView', () => {
  const repos = [
    repo({
      id: 'owner/rising',
      slug: 'owner-rising',
      activity: 'fast-rising',
      starDelta7d: 500,
      stars: 2_000,
    }),
    repo({
      id: 'owner/also-rising',
      slug: 'owner-also-rising',
      activity: 'fast-rising',
      starDelta7d: 900,
      stars: 1_500,
    }),
    repo({
      id: 'owner/today',
      slug: 'owner-today',
      activity: 'active',
      starDelta7d: null,
      stars: 100,
    }),
  ];

  it('keeps the Rising view aligned with fast-rising activity badges', () => {
    expect(
      filterReposForTrendView(repos, {
        view: 'rising',
        firstSeenDates: {},
        today: '2026-06-13',
      }).map((item) => item.id),
    ).toEqual(['owner/also-rising', 'owner/rising']);
  });

  it('shows repositories first seen in today snapshot in New today', () => {
    expect(
      filterReposForTrendView(repos, {
        view: 'new-today',
        firstSeenDates: {
          'owner/rising': '2026-06-12',
          'owner/also-rising': '2026-06-11',
          'owner/today': '2026-06-13',
        },
        today: '2026-06-13',
      }).map((item) => item.id),
    ).toEqual(['owner/today']);
  });
});

describe('compareByStarDelta', () => {
  it('falls back to stars when repositories have no seven-day delta', () => {
    const lowerStars = repo({
      id: 'owner/lower',
      slug: 'owner-lower',
      stars: 100,
      starDelta7d: null,
    });
    const higherStars = repo({
      id: 'owner/higher',
      slug: 'owner-higher',
      stars: 200,
      starDelta7d: null,
    });

    expect([lowerStars, higherStars].toSorted(compareByStarDelta)).toEqual([
      higherStars,
      lowerStars,
    ]);
  });
});
