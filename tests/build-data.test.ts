import { describe, expect, it } from 'vitest';
import {
  applySnapshotHistory,
  deriveStarHistory,
  downsampleSnapshots,
} from '../scripts/lib/build-data';
import type { RepoDetails, Snapshot } from '../src/lib/types';

const now = new Date('2026-06-13T12:00:00Z');

const repo: RepoDetails = {
  id: 'owner/project',
  slug: 'owner-project',
  owner: 'owner',
  name: 'project',
  description: 'A useful project',
  archived: false,
  primaryLanguage: 'TypeScript',
  languageColor: '#3178c6',
  stars: 1_000,
  forks: 100,
  openIssues: 10,
  pushedAt: '2026-05-01T00:00:00Z',
  topics: ['example'],
  license: 'MIT',
  activity: 'stable',
  starDelta7d: null,
  ownerAvatarUrl: null,
  languages: { TypeScript: 1 },
  readmeExcerpt: 'A useful project.',
  summary: {
    mode: 'template',
    text: 'project is a TypeScript project focused on A useful project.',
  },
  releases: [],
  starHistory: [],
  links: {
    repo: 'https://github.com/owner/project',
    homepage: null,
  },
};

const snapshots: Snapshot[] = [
  {
    date: '2026-06-13',
    repos: {
      'owner/project': { stars: 1_000, forks: 100, openIssues: 10 },
    },
  },
  {
    date: '2026-06-06',
    repos: {
      'owner/project': { stars: 600, forks: 80, openIssues: 12 },
    },
  },
  {
    date: '2026-06-01',
    repos: {
      'other/project': { stars: 50, forks: 5, openIssues: 1 },
    },
  },
];

describe('deriveStarHistory', () => {
  it('returns sorted star history for the selected repository only', () => {
    expect(deriveStarHistory('owner/project', snapshots)).toEqual([
      { date: '2026-06-06', stars: 600 },
      { date: '2026-06-13', stars: 1_000 },
    ]);
  });

  it('samples long history across the full range instead of keeping only the tail', () => {
    const longSnapshots = Array.from({ length: 120 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, index + 1))
        .toISOString()
        .slice(0, 10);

      return {
        date,
        repos: {
          'owner/project': {
            stars: index,
            forks: 0,
            openIssues: 0,
          },
        },
      } satisfies Snapshot;
    });
    const history = deriveStarHistory('owner/project', longSnapshots);

    expect(history).toHaveLength(90);
    expect(history[0]).toEqual({ date: '2026-01-01', stars: 0 });
    expect(history.at(-1)).toEqual({ date: '2026-04-30', stars: 119 });
  });
});

describe('applySnapshotHistory', () => {
  it('updates star history, seven-day delta, and activity from snapshots', () => {
    expect(applySnapshotHistory(repo, snapshots, now)).toMatchObject({
      starDelta7d: 400,
      activity: 'fast-rising',
      starHistory: [
        { date: '2026-06-06', stars: 600 },
        { date: '2026-06-13', stars: 1_000 },
      ],
    });
  });
});

describe('downsampleSnapshots', () => {
  it('keeps recent daily snapshots and one latest older snapshot per week', () => {
    const oldSameWeekA: Snapshot = {
      date: '2026-01-05',
      repos: { 'owner/project': { stars: 100, forks: 10, openIssues: 1 } },
    };
    const oldSameWeekB: Snapshot = {
      date: '2026-01-08',
      repos: { 'owner/project': { stars: 120, forks: 10, openIssues: 1 } },
    };
    const oldNextWeek: Snapshot = {
      date: '2026-01-15',
      repos: { 'owner/project': { stars: 130, forks: 10, openIssues: 1 } },
    };
    const recentA: Snapshot = {
      date: '2026-04-01',
      repos: { 'owner/project': { stars: 150, forks: 10, openIssues: 1 } },
    };
    const recentB: Snapshot = {
      date: '2026-06-13',
      repos: { 'owner/project': { stars: 200, forks: 10, openIssues: 1 } },
    };

    expect(
      downsampleSnapshots(
        [recentB, oldSameWeekA, recentA, oldNextWeek, oldSameWeekB],
        now,
      ).map((snapshot) => snapshot.date),
    ).toEqual(['2026-01-08', '2026-01-15', '2026-04-01', '2026-06-13']);
  });
});
