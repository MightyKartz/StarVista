import path from 'node:path';
import type { Manifest, RepoDetails, Snapshot } from '../../src/lib/types';
import { listJsonFiles, readJsonIfExists } from './io';

const DEFAULT_MAX_AGE_HOURS = 36;
const DEFAULT_DAILY_WINDOW_DAYS = 90;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface VerifyDataOptions {
  dataDir: string;
  maxAgeHours?: number;
  dailyWindowDays?: number;
  now?: Date;
}

export interface VerifyDataResult {
  ok: boolean;
  errors: string[];
}

export async function verifyData(
  options: VerifyDataOptions,
): Promise<VerifyDataResult> {
  const dataDir = options.dataDir;
  const maxAgeHours = options.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS;
  const dailyWindowDays = options.dailyWindowDays ?? DEFAULT_DAILY_WINDOW_DAYS;
  const now = options.now ?? new Date();
  const errors: string[] = [];

  const manifestPath = path.join(dataDir, 'manifest.json');
  const manifest = await readManifest(manifestPath, errors);

  if (manifest) {
    verifyGeneratedAt(manifest, now, maxAgeHours, errors);
    verifyRepoCount(manifest, errors);
    await verifyRepoDetails(dataDir, manifest, errors);
  }

  await verifySnapshots(dataDir, now, maxAgeHours, dailyWindowDays, errors);

  return {
    ok: errors.length === 0,
    errors,
  };
}

async function readManifest(
  manifestPath: string,
  errors: string[],
): Promise<Manifest | null> {
  try {
    const manifest = await readJsonIfExists<Manifest>(manifestPath);

    if (!manifest) {
      errors.push(`Missing manifest.json at ${manifestPath}`);
    }

    return manifest;
  } catch (error) {
    errors.push(`Unable to read manifest.json: ${formatError(error)}`);
    return null;
  }
}

function verifyGeneratedAt(
  manifest: Manifest,
  now: Date,
  maxAgeHours: number,
  errors: string[],
): void {
  const generatedAt = new Date(manifest.generatedAt);

  if (Number.isNaN(generatedAt.valueOf())) {
    errors.push(
      `manifest.json generatedAt is not a valid date: ${manifest.generatedAt}`,
    );
    return;
  }

  if (generatedAt.valueOf() - now.valueOf() > FUTURE_TOLERANCE_MS) {
    errors.push(
      `manifest.json generatedAt is in the future: ${manifest.generatedAt}`,
    );
    return;
  }

  const ageHours = (now.valueOf() - generatedAt.valueOf()) / HOUR_MS;

  if (ageHours > maxAgeHours) {
    errors.push(
      `manifest.json generatedAt is older than ${maxAgeHours} hours: ${manifest.generatedAt}`,
    );
  }
}

function verifyRepoCount(manifest: Manifest, errors: string[]): void {
  if (manifest.repoCount !== manifest.repos.length) {
    errors.push(
      `manifest.json repoCount is ${manifest.repoCount} but contains ${manifest.repos.length} repositories`,
    );
  }
}

async function verifyRepoDetails(
  dataDir: string,
  manifest: Manifest,
  errors: string[],
): Promise<void> {
  await Promise.all(
    manifest.repos.map(async (repo) => {
      const relativePath = path.join('repos', `${repo.slug}.json`);
      const detailPath = path.join(dataDir, relativePath);

      try {
        const details = await readJsonIfExists<RepoDetails>(detailPath);

        if (!details) {
          errors.push(
            `Missing repository detail file for ${repo.id}: ${relativePath}`,
          );
          return;
        }

        if (details.id !== repo.id) {
          errors.push(
            `Repository detail id mismatch for ${repo.id}: ${relativePath} has id ${details.id}`,
          );
        }
      } catch (error) {
        errors.push(
          `Unable to read repository detail file for ${repo.id}: ${relativePath} (${formatError(error)})`,
        );
      }
    }),
  );
}

async function verifySnapshots(
  dataDir: string,
  now: Date,
  maxAgeHours: number,
  dailyWindowDays: number,
  errors: string[],
): Promise<void> {
  const snapshotsDir = path.join(dataDir, 'snapshots');
  const files = await listJsonFiles(snapshotsDir);

  if (files.length === 0) {
    errors.push(`Missing snapshot JSON files in ${snapshotsDir}`);
    return;
  }

  const snapshots = await readSnapshots(files, errors);
  verifyDuplicateSnapshotDates(snapshots, errors);

  const dates = snapshots
    .map(({ snapshot }) => snapshot.date)
    .filter((date) => isValidIsoDate(date))
    .sort();

  if (dates.length === 0) {
    errors.push('No snapshots contain valid YYYY-MM-DD dates');
    return;
  }

  verifyLatestSnapshot(dates.at(-1) as string, now, maxAgeHours, errors);
  verifyDailyContinuity(
    datesInDailyWindow([...new Set(dates)], now, dailyWindowDays),
    errors,
  );
}

interface SnapshotFile {
  snapshot: Snapshot;
  relativePath: string;
}

async function readSnapshots(
  files: string[],
  errors: string[],
): Promise<SnapshotFile[]> {
  const snapshots = await Promise.all(
    files.map(async (file) => {
      const fileName = path.basename(file);
      const fileDate = path.basename(file, '.json');
      const relativePath = path.join('snapshots', fileName);

      try {
        const snapshot = await readJsonIfExists<Snapshot>(file);

        if (!snapshot) {
          errors.push(`Missing snapshot file: ${relativePath}`);
        } else if (!isValidIsoDate(snapshot.date)) {
          errors.push(
            `Snapshot ${relativePath} has invalid date: ${snapshot.date}`,
          );
        } else if (fileDate !== snapshot.date) {
          errors.push(
            `Snapshot filename/date mismatch: ${relativePath} contains ${snapshot.date}`,
          );
        }

        return snapshot ? { snapshot, relativePath } : null;
      } catch (error) {
        errors.push(
          `Unable to read snapshot ${relativePath}: ${formatError(error)}`,
        );
        return null;
      }
    }),
  );

  return snapshots.filter(
    (snapshot): snapshot is SnapshotFile => snapshot !== null,
  );
}

function verifyDuplicateSnapshotDates(
  snapshots: SnapshotFile[],
  errors: string[],
): void {
  const pathsByDate = new Map<string, string[]>();

  for (const { snapshot, relativePath } of snapshots) {
    if (!isValidIsoDate(snapshot.date)) {
      continue;
    }

    const paths = pathsByDate.get(snapshot.date) ?? [];
    paths.push(relativePath);
    pathsByDate.set(snapshot.date, paths);
  }

  for (const [date, paths] of pathsByDate) {
    if (paths.length > 1) {
      errors.push(
        `Duplicate snapshot date ${date} appears in ${paths.join(', ')}`,
      );
    }
  }
}

function verifyLatestSnapshot(
  latestDate: string,
  now: Date,
  maxAgeHours: number,
  errors: string[],
): void {
  const latestTime = parseIsoDate(latestDate).valueOf();
  if (latestTime - now.valueOf() > FUTURE_TOLERANCE_MS) {
    errors.push(`Latest snapshot is in the future: ${latestDate}`);
    return;
  }

  const ageHours = (now.valueOf() - latestTime) / HOUR_MS;

  if (ageHours > maxAgeHours) {
    errors.push(
      `Latest snapshot is older than ${maxAgeHours} hours: ${latestDate}`,
    );
  }
}

function datesInDailyWindow(
  dates: string[],
  now: Date,
  dailyWindowDays: number,
): string[] {
  const startTime = parseIsoDate(now.toISOString().slice(0, 10)).valueOf();
  const windowStartTime = startTime - dailyWindowDays * DAY_MS;

  return dates.filter(
    (date) => parseIsoDate(date).valueOf() >= windowStartTime,
  );
}

function verifyDailyContinuity(dates: string[], errors: string[]): void {
  for (let index = 1; index < dates.length; index += 1) {
    const previous = dates[index - 1];
    const current = dates[index];
    const missingDates = datesBetween(previous, current);

    if (missingDates.length > 0) {
      errors.push(
        `Snapshot history has a daily gap between ${previous} and ${current}; missing ${missingDates.join(', ')}`,
      );
    }
  }
}

function datesBetween(startDate: string, endDate: string): string[] {
  const missingDates: string[] = [];
  const start = parseIsoDate(startDate).valueOf();
  const end = parseIsoDate(endDate).valueOf();

  for (let time = start + DAY_MS; time < end; time += DAY_MS) {
    missingDates.push(new Date(time).toISOString().slice(0, 10));
  }

  return missingDates;
}

function isValidIsoDate(date: string): boolean {
  if (!ISO_DATE_PATTERN.test(date)) {
    return false;
  }

  return parseIsoDate(date).toISOString().slice(0, 10) === date;
}

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
