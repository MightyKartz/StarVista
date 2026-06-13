import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function getDataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), 'public/data');
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

export async function writeJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function listJsonFiles(dirPath: string): Promise<string[]> {
  if (!(await pathExists(dirPath))) {
    return [];
  }

  return (await readdir(dirPath))
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dirPath, file))
    .sort();
}

export function todayIsoDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
