import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import fixtureManifestJson from '../../fixtures/sample-manifest.json';
import fixtureRepoJson from '../../fixtures/sample-repo.json';
import type { Manifest, RepoDetails } from './types';

const fixtureManifest = fixtureManifestJson as Manifest;
const fixtureRepo = fixtureRepoJson as RepoDetails;

export function loadManifest(dataDir = defaultDataDir()): Manifest {
  return (
    readJsonIfExists<Manifest>(path.join(dataDir, 'manifest.json')) ??
    fixtureManifest
  );
}

export function loadRepoDetails(
  slug: string,
  dataDir = defaultDataDir(),
): RepoDetails | null {
  return (
    readJsonIfExists<RepoDetails>(
      path.join(dataDir, 'repos', `${slug}.json`),
    ) ?? fixtureRepoBySlug(slug)
  );
}

function defaultDataDir(): string {
  return (
    process.env.STARVISTA_DATA_DIR ?? path.join(process.cwd(), 'public/data')
  );
}

function readJsonIfExists<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function fixtureRepoBySlug(slug: string): RepoDetails | null {
  return slug === fixtureRepo.slug ? fixtureRepo : null;
}
