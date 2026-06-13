import path from 'node:path';
import type { Octokit } from '@octokit/rest';
import type {
  Manifest,
  ManifestRepo,
  RepoDetails,
  RepoRelease,
  RepoSummary,
} from '../src/lib/types';
import { createGitHubClient, isNotFound, withGitHubRetry } from './lib/github';
import { ensureDir, getDataDir, readJsonIfExists, writeJson } from './lib/io';
import { mergeManifestRepos } from './lib/manifest';
import {
  createTemplateSummary,
  extractReadmeExcerpt,
  normalizeLanguages,
  normalizeManifestRepo,
  type GitHubSearchRepo,
} from './lib/normalize';
import { createReadmeHash, resolveRepoSummary } from './lib/summary';

const REPO_LIMIT = Number(process.env.STARVISTA_REPO_LIMIT ?? 100);
const RECENT_PUSH_DAYS = Number(process.env.STARVISTA_RECENT_PUSH_DAYS ?? 30);
const AI_SUMMARY_API_KEY = process.env.OPENAI_API_KEY;
const AI_SUMMARY_MODEL = process.env.OPENAI_MODEL || undefined;

interface ReadmeProfile {
  excerpt: string | null;
  hash: string | null;
}

async function main(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required for npm run fetch');
  }

  const dataDir = getDataDir();
  const reposDir = path.join(dataDir, 'repos');
  await ensureDir(reposDir);
  const existingManifest = await readJsonIfExists<Manifest>(
    path.join(dataDir, 'manifest.json'),
  );

  const octokit = createGitHubClient();
  const repos = await searchRepositories(octokit);
  const currentSearchRepos = new Map(
    repos.map((repo) => [repo.full_name, repo] as const),
  );
  const currentManifestRepos = repos.map((repo) => normalizeManifestRepo(repo));
  const manifestRepos = mergeManifestRepos(
    currentManifestRepos,
    existingManifest?.repos ?? [],
  );
  const writtenManifestRepos: ManifestRepo[] = [];

  for (const manifestRepo of manifestRepos) {
    const searchRepo = currentSearchRepos.get(manifestRepo.id);
    const detailPath = path.join(reposDir, `${manifestRepo.slug}.json`);
    const existing = await readJsonIfExists<RepoDetails>(detailPath);

    if (!searchRepo) {
      if (!existing) {
        console.warn(
          `Missing historical detail data for ${manifestRepo.id}; skipping manifest entry`,
        );
        continue;
      }

      await writeJson(detailPath, mergeExistingDetails(manifestRepo, existing));
      writtenManifestRepos.push(manifestRepo);
      continue;
    }

    const shouldRefreshDetails =
      !existing ||
      existing.pushedAt !== manifestRepo.pushedAt ||
      (Boolean(AI_SUMMARY_API_KEY) && !hasReusableLlmSummary(existing.summary));
    const details =
      existing && !shouldRefreshDetails
        ? mergeExistingDetails(manifestRepo, existing)
        : await fetchRepoDetails(
            octokit,
            searchRepo,
            manifestRepo,
            existing ?? undefined,
          );

    await writeJson(detailPath, details);
    writtenManifestRepos.push(manifestRepo);
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    repoCount: writtenManifestRepos.length,
    repos: writtenManifestRepos,
  };

  await writeJson(path.join(dataDir, 'manifest.json'), manifest);
  console.log(`Wrote ${manifest.repoCount} repositories to ${dataDir}`);
}

async function searchRepositories(
  octokit: Octokit,
): Promise<GitHubSearchRepo[]> {
  const pushedAfter = new Date(
    Date.now() - RECENT_PUSH_DAYS * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
  const perPage = Math.min(REPO_LIMIT, 100);

  const response = await withGitHubRetry(
    () =>
      octokit.rest.search.repos({
        q: `stars:>10000 pushed:>=${pushedAfter} archived:false`,
        sort: 'stars',
        order: 'desc',
        per_page: perPage,
      }),
    'search repositories',
  );

  return response.data.items.slice(0, REPO_LIMIT) as GitHubSearchRepo[];
}

async function fetchRepoDetails(
  octokit: Octokit,
  searchRepo: GitHubSearchRepo,
  manifestRepo: ManifestRepo,
  existing?: RepoDetails,
): Promise<RepoDetails> {
  const [owner, repo] = manifestRepo.id.split('/');
  const [languages, readmeProfile, releases] = await Promise.all([
    fetchLanguages(octokit, owner, repo),
    fetchReadmeProfile(octokit, owner, repo),
    fetchReleases(octokit, owner, repo),
  ]);
  const summary = await resolveRepoSummary({
    repo: manifestRepo,
    readmeExcerpt: readmeProfile.excerpt,
    readmeHash: readmeProfile.hash,
    existingSummary: existing?.summary,
    apiKey: AI_SUMMARY_API_KEY,
    model: AI_SUMMARY_MODEL,
  });

  return {
    ...manifestRepo,
    languages,
    readmeExcerpt: readmeProfile.excerpt,
    summary,
    releases,
    starHistory: [],
    links: {
      repo: searchRepo.html_url ?? `https://github.com/${manifestRepo.id}`,
      homepage: searchRepo.homepage || null,
    },
  };
}

async function fetchLanguages(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Record<string, number>> {
  try {
    const response = await withGitHubRetry(
      () => octokit.rest.repos.listLanguages({ owner, repo }),
      `${owner}/${repo} languages`,
    );

    return normalizeLanguages(response.data);
  } catch (error) {
    console.warn(
      `${owner}/${repo} languages unavailable: ${formatError(error)}`,
    );
    return {};
  }
}

async function fetchReadmeProfile(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<ReadmeProfile> {
  try {
    const response = await withGitHubRetry(
      () => octokit.rest.repos.getReadme({ owner, repo }),
      `${owner}/${repo} readme`,
    );

    const content = Array.isArray(response.data) ? null : response.data.content;
    const markdown = content
      ? Buffer.from(content, 'base64').toString('utf8')
      : null;

    return {
      excerpt: extractReadmeExcerpt(markdown),
      hash: createReadmeHash(markdown),
    };
  } catch (error) {
    if (isNotFound(error)) {
      console.warn(`${owner}/${repo} has no README`);
      return { excerpt: null, hash: null };
    }

    console.warn(`${owner}/${repo} README unavailable: ${formatError(error)}`);
    return { excerpt: null, hash: null };
  }
}

async function fetchReleases(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoRelease[]> {
  try {
    const response = await withGitHubRetry(
      () => octokit.rest.repos.listReleases({ owner, repo, per_page: 5 }),
      `${owner}/${repo} releases`,
    );

    return response.data.map((release) => ({
      tag: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
    }));
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }

    console.warn(
      `${owner}/${repo} releases unavailable: ${formatError(error)}`,
    );
    return [];
  }
}

function mergeExistingDetails(
  manifestRepo: ManifestRepo,
  existing: RepoDetails,
): RepoDetails {
  return {
    ...existing,
    ...manifestRepo,
    summary:
      AI_SUMMARY_API_KEY && hasReusableLlmSummary(existing.summary)
        ? existing.summary
        : createTemplateSummary(manifestRepo),
  };
}

function hasReusableLlmSummary(
  summary: RepoSummary | undefined,
): summary is RepoSummary & { mode: 'llm'; readmeHash: string } {
  return summary?.mode === 'llm' && Boolean(summary.readmeHash);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
