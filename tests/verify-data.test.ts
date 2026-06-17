import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyData } from '../scripts/lib/verify-data';
import type { Manifest, RepoDetails, Snapshot } from '../src/lib/types';

const now = new Date('2026-06-17T12:00:00Z');

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function tempDataDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'starvista-verify-'));
  tempDirs.push(dir);
  return dir;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function repo(overrides: Partial<RepoDetails> = {}): RepoDetails {
  return {
    id: 'owner/project',
    slug: 'owner-project',
    owner: 'owner',
    name: 'project',
    description: 'A useful project',
    archived: false,
    primaryLanguage: 'TypeScript',
    languageColor: '#3178c6',
    stars: 100,
    forks: 10,
    openIssues: 1,
    pushedAt: '2026-06-17T00:00:00Z',
    topics: [],
    license: 'MIT',
    activity: 'active',
    starDelta7d: null,
    ownerAvatarUrl: null,
    languages: {},
    readmeExcerpt: null,
    summary: { mode: 'template', text: 'A useful project.' },
    releases: [],
    starHistory: [],
    links: { repo: 'https://github.com/owner/project', homepage: null },
    ...overrides,
  };
}

function snapshot(date: string): Snapshot {
  return {
    date,
    repos: {
      'owner/project': {
        stars: 100,
        forks: 10,
        openIssues: 1,
      },
    },
  };
}

function writeHealthyData(dataDir: string): void {
  const details = repo();
  const manifest: Manifest = {
    generatedAt: '2026-06-17T06:00:00Z',
    repoCount: 1,
    repos: [details],
  };

  writeJson(path.join(dataDir, 'manifest.json'), manifest);
  writeJson(path.join(dataDir, 'repos', `${details.slug}.json`), details);
  writeJson(
    path.join(dataDir, 'snapshots', '2026-06-16.json'),
    snapshot('2026-06-16'),
  );
  writeJson(
    path.join(dataDir, 'snapshots', '2026-06-17.json'),
    snapshot('2026-06-17'),
  );
}

describe('verifyData', () => {
  it('accepts healthy generated data', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);

    await expect(verifyData({ dataDir, now })).resolves.toEqual({
      ok: true,
      errors: [],
    });
  });

  it('reports stale generatedAt timestamps', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    const details = repo();
    writeJson(path.join(dataDir, 'manifest.json'), {
      generatedAt: '2026-06-15T23:59:59Z',
      repoCount: 1,
      repos: [details],
    } satisfies Manifest);

    const result = await verifyData({ dataDir, now, maxAgeHours: 36 });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'manifest.json generatedAt is older than 36 hours: 2026-06-15T23:59:59Z',
    );
  });

  it('reports missing repository detail files', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    rmSync(path.join(dataDir, 'repos', 'owner-project.json'));

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Missing repository detail file for owner/project: repos/owner-project.json',
    );
  });

  it('reports unreadable repository details and id mismatches', async () => {
    const dataDir = tempDataDir();
    const firstRepo = repo();
    const secondRepo = repo({
      id: 'owner/other',
      slug: 'owner-other',
      name: 'other',
    });
    writeJson(path.join(dataDir, 'manifest.json'), {
      generatedAt: '2026-06-17T06:00:00Z',
      repoCount: 2,
      repos: [firstRepo, secondRepo],
    } satisfies Manifest);
    writeText(path.join(dataDir, 'repos', 'owner-project.json'), '{');
    writeJson(
      path.join(dataDir, 'repos', 'owner-other.json'),
      repo({ id: 'owner/wrong', slug: 'owner-other', name: 'other' }),
    );
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-17.json'),
      snapshot('2026-06-17'),
    );

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Unable to read repository detail file for owner/project: repos/owner-project.json',
        ),
        'Repository detail id mismatch for owner/other: repos/owner-other.json has id owner/wrong',
      ]),
    );
  });

  it('reports generatedAt timestamps too far in the future', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    const details = repo();
    writeJson(path.join(dataDir, 'manifest.json'), {
      generatedAt: '2026-06-17T13:00:01Z',
      repoCount: 1,
      repos: [details],
    } satisfies Manifest);

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'manifest.json generatedAt is in the future: 2026-06-17T13:00:01Z',
    );
  });

  it('reports stale latest snapshots', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    rmSync(path.join(dataDir, 'snapshots'), { recursive: true, force: true });
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-15.json'),
      snapshot('2026-06-15'),
    );

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Latest snapshot is older than 36 hours: 2026-06-15',
    );
  });

  it('reports latest snapshots too far in the future', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-18.json'),
      snapshot('2026-06-18'),
    );

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Latest snapshot is in the future: 2026-06-18',
    );
  });

  it('reports gaps in daily snapshot history', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    rmSync(path.join(dataDir, 'snapshots'), { recursive: true, force: true });
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-15.json'),
      snapshot('2026-06-15'),
    );
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-17.json'),
      snapshot('2026-06-17'),
    );

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Snapshot history has a daily gap between 2026-06-15 and 2026-06-17; missing 2026-06-16',
    );
  });

  it('allows downsampled weekly gaps before the 90-day daily window', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    writeJson(
      path.join(dataDir, 'snapshots', '2026-01-01.json'),
      snapshot('2026-01-01'),
    );
    writeJson(
      path.join(dataDir, 'snapshots', '2026-01-08.json'),
      snapshot('2026-01-08'),
    );
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-15.json'),
      snapshot('2026-06-15'),
    );

    await expect(verifyData({ dataDir, now })).resolves.toEqual({
      ok: true,
      errors: [],
    });
  });

  it('reports snapshot filename mismatches and duplicate snapshot dates', async () => {
    const dataDir = tempDataDir();
    writeHealthyData(dataDir);
    rmSync(path.join(dataDir, 'snapshots'), { recursive: true, force: true });
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-16.json'),
      snapshot('2026-06-16'),
    );
    writeJson(
      path.join(dataDir, 'snapshots', '2026-06-17.json'),
      snapshot('2026-06-16'),
    );

    const result = await verifyData({ dataDir, now });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Snapshot filename/date mismatch: snapshots/2026-06-17.json contains 2026-06-16',
        'Duplicate snapshot date 2026-06-16 appears in snapshots/2026-06-16.json, snapshots/2026-06-17.json',
      ]),
    );
  });
});
