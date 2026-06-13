import path from 'node:path';
import type { Manifest, Snapshot } from '../src/lib/types';
import {
  getDataDir,
  readJsonIfExists,
  todayIsoDate,
  writeJson,
} from './lib/io';

async function main(): Promise<void> {
  const dataDir = getDataDir();
  const manifest = await readJsonIfExists<Manifest>(
    path.join(dataDir, 'manifest.json'),
  );

  if (!manifest) {
    throw new Error(
      `Missing manifest.json in ${dataDir}; run npm run fetch first`,
    );
  }

  const date = process.env.STARVISTA_SNAPSHOT_DATE ?? todayIsoDate();
  const snapshot: Snapshot = {
    date,
    repos: Object.fromEntries(
      manifest.repos.map((repo) => [
        repo.id,
        {
          stars: repo.stars,
          forks: repo.forks,
          openIssues: repo.openIssues,
        },
      ]),
    ),
  };

  await writeJson(path.join(dataDir, 'snapshots', `${date}.json`), snapshot);
  console.log(`Wrote snapshot ${date} for ${manifest.repoCount} repositories`);
}

await main();
