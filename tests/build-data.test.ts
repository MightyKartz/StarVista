import { describe, expect, it } from 'vitest';
import {
  applySnapshotHistory,
  deriveStarHistory,
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
