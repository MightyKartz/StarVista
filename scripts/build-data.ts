import path from 'node:path';
import type { Manifest, RepoDetails, Snapshot } from '../src/lib/types';
import { applySnapshotHistory } from './lib/build-data';
import {
  getDataDir,
  listJsonFiles,
  readJsonIfExists,
  writeJson,
} from './lib/io';

async function main(): Promise<void> {
  const dataDir = getDataDir();
  const manifestPath = path.join(dataDir, 'manifest.json');
  const manifest = await readJsonIfExists<Manifest>(manifestPath);

  if (!manifest) {
    throw new Error(
      `Missing manifest.json in ${dataDir}; run npm run fetch first`,
    );
  }

  const snapshots = await readSnapshots(path.join(dataDir, 'snapshots'));
  const repos = [];

  for (const manifestRepo of manifest.repos) {
    const detailPath = path.join(dataDir, 'repos', `${manifestRepo.slug}.json`);
    const details = await readJsonIfExists<RepoDetails>(detailPath);

    if (!details) {
      console.warn(
        `Missing detail data for ${manifestRepo.id}; skipping history build`,
      );
      repos.push(manifestRepo);
      continue;
    }

    const updatedDetails = applySnapshotHistory(details, snapshots);
    await writeJson(detailPath, updatedDetails);
    repos.push({
      ...manifestRepo,
      activity: updatedDetails.activity,
      starDelta7d: updatedDetails.starDelta7d,
    });
  }

  await writeJson(manifestPath, {
    ...manifest,
    generatedAt: new Date().toISOString(),
    repoCount: repos.length,
    repos,
  });

  console.log(`Built snapshot history from ${snapshots.length} snapshot(s)`);
}

async function readSnapshots(snapshotsDir: string): Promise<Snapshot[]> {
  const files = await listJsonFiles(snapshotsDir);
  const snapshots = await Promise.all(
    files.map(async (file) => readJsonIfExists<Snapshot>(file)),
  );

  return snapshots
    .filter((snapshot): snapshot is Snapshot => snapshot !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

await main();
