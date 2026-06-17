import path from 'node:path';
import { verifyData } from './lib/verify-data';

interface CliOptions {
  dataDir: string;
  maxAgeHours: number;
  now?: Date;
}

function parseArgs(argv: string[], env: NodeJS.ProcessEnv): CliOptions {
  let dataDir = env.DATA_DIR ?? path.join(process.cwd(), 'public/data');
  let maxAgeHours = 36;
  let now: Date | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--data-dir') {
      dataDir = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--max-age-hours') {
      maxAgeHours = Number(readValue(argv, index, arg));
      index += 1;
    } else if (arg === '--now') {
      now = new Date(readValue(argv, index, arg));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error('--max-age-hours must be a positive number');
  }

  if (now && Number.isNaN(now.valueOf())) {
    throw new Error('--now must be a valid date');
  }

  return { dataDir, maxAgeHours, now };
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2), process.env);
  const result = await verifyData(options);

  if (!result.ok) {
    console.error('Data verification failed:');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Data verification passed for ${options.dataDir}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
