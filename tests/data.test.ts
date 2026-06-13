import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadManifest, loadRepoDetails } from '../src/lib/data';
import type { Manifest, RepoDetails } from '../src/lib/types';

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function tempDataDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'starvista-data-'));
  tempDirs.push(dir);
  return dir;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe('loadManifest', () => {
  it('loads generated public data when manifest exists', () => {
    const dir = tempDataDir();
    const manifest: Manifest = {
      generatedAt: '2026-06-13T02:00:00Z',
      repoCount: 0,
      repos: [],
    };
    writeJson(path.join(dir, 'manifest.json'), manifest);

    expect(loadManifest(dir)).toEqual(manifest);
  });

  it('falls back to fixture data when generated data is absent', () => {
    expect(loadManifest(tempDataDir()).repoCount).toBe(3);
  });
});

describe('loadRepoDetails', () => {
  it('loads generated repository details when present', () => {
    const dir = tempDataDir();
    const details: RepoDetails = {
      id: 'owner/project',
      slug: 'owner-project',
      owner: 'owner',
      name: 'project',
      description: 'A generated project',
      archived: false,
      primaryLanguage: 'TypeScript',
      languageColor: '#3178c6',
      stars: 1,
      forks: 2,
      openIssues: 3,
      pushedAt: '2026-06-13T00:00:00Z',
      topics: [],
      license: null,
      activity: 'active',
      starDelta7d: null,
      ownerAvatarUrl: null,
      languages: {},
      readmeExcerpt: null,
      summary: { mode: 'template', text: 'Generated.' },
      releases: [],
      starHistory: [],
      links: { repo: 'https://github.com/owner/project', homepage: null },
    };
    writeJson(path.join(dir, 'repos', 'owner-project.json'), details);

    expect(loadRepoDetails('owner-project', dir)).toEqual(details);
  });

  it('falls back to fixture details when generated details are absent', () => {
    expect(loadRepoDetails('vercel-next.js', tempDataDir())?.id).toBe(
      'vercel/next.js',
    );
  });
});
