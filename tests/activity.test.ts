import { describe, expect, it } from 'vitest';
import { classifyActivity } from '../src/lib/activity';
import type { Snapshot } from '../src/lib/types';

const now = new Date('2026-06-13T12:00:00Z');

function repo(overrides: Partial<Parameters<typeof classifyActivity>[0]> = {}) {
  return {
    id: 'owner/project',
    archived: false,
    stars: 10_000,
    pushedAt: '2026-06-12T12:00:00Z',
    ...overrides,
  };
}

function snapshot(date: string, stars: number): Snapshot {
  return {
    date,
    repos: {
      'owner/project': {
        stars,
        forks: 100,
        openIssues: 10,
      },
    },
  };
}

describe('classifyActivity', () => {
  it('returns archived before any other activity signal', () => {
    const snapshots = [snapshot('2026-06-06', 9_000)];

    expect(
      classifyActivity(repo({ archived: true, stars: 10_500 }), snapshots, now),
    ).toBe('archived');
  });

  it('returns fast-rising when seven-day star gain clears the larger threshold', () => {
    const snapshots = [snapshot('2026-06-06', 19_300)];

    expect(classifyActivity(repo({ stars: 20_000 }), snapshots, now)).toBe(
      'fast-rising',
    );
  });

  it('skips fast-rising when snapshot history is shorter than seven days', () => {
    const snapshots = [snapshot('2026-06-07', 9_000)];

    expect(classifyActivity(repo({ stars: 10_000 }), snapshots, now)).toBe(
      'active',
    );
  });

  it('returns active when the last push is within fourteen days', () => {
    expect(
      classifyActivity(repo({ pushedAt: '2026-06-01T12:00:00Z' }), [], now),
    ).toBe('active');
  });

  it('returns stable when the last push is within ninety days', () => {
    expect(
      classifyActivity(repo({ pushedAt: '2026-04-01T12:00:00Z' }), [], now),
    ).toBe('stable');
  });

  it('returns cooling when no fresher activity signal matches', () => {
    expect(
      classifyActivity(repo({ pushedAt: '2025-12-01T12:00:00Z' }), [], now),
    ).toBe('cooling');
  });
});
