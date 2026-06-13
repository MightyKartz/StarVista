import path from 'node:path';
import type { Octokit } from '@octokit/rest';
import type {
  Manifest,
  ManifestRepo,
  RepoDetails,
  RepoRelease,
} from '../src/lib/types';
import { createGitHubClient, isNotFound, withGitHubRetry } from './lib/github';
import { ensureDir, getDataDir, readJsonIfExists, writeJson } from './lib/io';
import {
  createTemplateSummary,
  extractReadmeExcerpt,
  normalizeLanguages,
  normalizeManifestRepo,
  type GitHubSearchRepo,
} from './lib/normalize';

const REPO_LIMIT = Number(process.env.STARVISTA_REPO_LIMIT ?? 100);
const RECENT_PUSH_DAYS = Number(process.env.STARVISTA_RECENT_PUSH_DAYS ?? 30);

async function main(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required for npm run fetch');
  }

  const dataDir = getDataDir();
  const reposDir = path.join(dataDir, 'repos');
  await ensureDir(reposDir);

  const octokit = createGitHubClient();
  const repos = await searchRepositories(octokit);
  const manifestRepos: ManifestRepo[] = [];

  for (const searchRepo of repos) {
    const manifestRepo = normalizeManifestRepo(searchRepo);
    manifestRepos.push(manifestRepo);

    const detailPath = path.join(reposDir, `${manifestRepo.slug}.json`);
    const existing = await readJsonIfExists<RepoDetails>(detailPath);
    const details =
      existing && existing.pushedAt === manifestRepo.pushedAt
        ? mergeExistingDetails(manifestRepo, existing)
        : await fetchRepoDetails(octokit, searchRepo, manifestRepo);

    await writeJson(detailPath, details);
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    repoCount: manifestRepos.length,
    repos: manifestRepos,
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
): Promise<RepoDetails> {
  const [owner, repo] = manifestRepo.id.split('/');
  const [languages, readmeExcerpt, releases] = await Promise.all([
    fetchLanguages(octokit, owner, repo),
    fetchReadmeExcerpt(octokit, owner, repo),
    fetchReleases(octokit, owner, repo),
  ]);

  return {
    ...manifestRepo,
    languages,
    readmeExcerpt,
    summary: createTemplateSummary(manifestRepo),
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

async function fetchReadmeExcerpt(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<string | null> {
  try {
    const response = await withGitHubRetry(
      () => octokit.rest.repos.getReadme({ owner, repo }),
      `${owner}/${repo} readme`,
    );

    const content = Array.isArray(response.data) ? null : response.data.content;
    return content
      ? extractReadmeExcerpt(Buffer.from(content, 'base64').toString('utf8'))
      : null;
  } catch (error) {
    if (isNotFound(error)) {
      console.warn(`${owner}/${repo} has no README`);
      return null;
    }

    console.warn(`${owner}/${repo} README unavailable: ${formatError(error)}`);
    return null;
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
    summary: createTemplateSummary(manifestRepo),
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
