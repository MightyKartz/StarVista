import path from 'node:path';
import { unlink } from 'node:fs/promises';
import type { Manifest, RepoDetails, Snapshot } from '../src/lib/types';
import { applySnapshotHistory, downsampleSnapshots } from './lib/build-data';
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

  const snapshotsDir = path.join(dataDir, 'snapshots');
  const snapshots = await readSnapshots(snapshotsDir);
  const retainedSnapshots = downsampleSnapshots(snapshots);
  await pruneSnapshotFiles(snapshotsDir, snapshots, retainedSnapshots);
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

    const updatedDetails = applySnapshotHistory(details, retainedSnapshots);
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

  console.log(
    `Built snapshot history from ${retainedSnapshots.length} retained snapshot(s)`,
  );
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

async function pruneSnapshotFiles(
  snapshotsDir: string,
  snapshots: Snapshot[],
  retainedSnapshots: Snapshot[],
): Promise<void> {
  const retainedDates = new Set(
    retainedSnapshots.map((snapshot) => snapshot.date),
  );
  const staleSnapshots = snapshots.filter(
    (snapshot) => !retainedDates.has(snapshot.date),
  );

  await Promise.all(
    staleSnapshots.map((snapshot) =>
      unlink(path.join(snapshotsDir, `${snapshot.date}.json`)),
    ),
  );
}

await main();
