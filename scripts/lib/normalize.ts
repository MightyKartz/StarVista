import type { ManifestRepo, RepoSummary } from '../../src/lib/types';
import { classifyActivity } from '../../src/lib/activity';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Python: '#3572a5',
  Go: '#00add8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  PHP: '#4f5d95',
  Swift: '#f05138',
};

const MAX_EXCERPT_LENGTH = 500;

export interface GitHubSearchRepo {
  full_name: string;
  html_url?: string;
  homepage?: string | null;
  name: string;
  owner: {
    login: string;
    avatar_url?: string | null;
  };
  description: string | null;
  archived?: boolean;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  topics?: string[];
  license?: {
    spdx_id?: string | null;
    name?: string | null;
  } | null;
}

export function slugFromRepoId(repoId: string): string {
  return repoId.replace('/', '-');
}

export function normalizeManifestRepo(
  repo: GitHubSearchRepo,
  now = new Date(),
): ManifestRepo {
  const id = repo.full_name;
  const archived = repo.archived ?? false;
  const stars = repo.stargazers_count;
  const pushedAt = repo.pushed_at;
  const primaryLanguage = repo.language;

  return {
    id,
    slug: slugFromRepoId(id),
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description,
    archived,
    primaryLanguage,
    languageColor: primaryLanguage
      ? (LANGUAGE_COLORS[primaryLanguage] ?? null)
      : null,
    stars,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    pushedAt,
    topics: repo.topics ?? [],
    license: normalizeLicense(repo.license),
    activity: classifyActivity({ id, archived, stars, pushedAt }, [], now),
    starDelta7d: null,
    ownerAvatarUrl: repo.owner.avatar_url ?? null,
  };
}

export function normalizeLanguages(
  languages: Record<string, number>,
): Record<string, number> {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);

  if (total <= 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .map(([language, bytes]) => [
        language,
        Math.round((bytes / total) * 100) / 100,
      ]),
  );
}

export function extractReadmeExcerpt(markdown: string | null): string | null {
  if (!markdown) {
    return null;
  }

  const paragraph = markdown
    .split(/\n\s*\n/)
    .map(cleanMarkdownBlock)
    .find((block) => block.length > 0);

  return paragraph ? truncateExcerpt(paragraph) : null;
}

export function createTemplateSummary(repo: ManifestRepo): RepoSummary {
  const language = repo.primaryLanguage ?? 'open-source';
  const focus = (repo.description ?? repo.id).replace(/\.$/, '');
  const topics = repo.topics.slice(0, 3);
  const topicSentence =
    topics.length > 0 ? ` It is tagged with ${formatList(topics)}.` : '';

  return {
    mode: 'template',
    text: `${repo.name} is a ${language} project focused on ${focus}.${topicSentence}`,
  };
}

function normalizeLicense(license: GitHubSearchRepo['license']): string | null {
  const value = license?.spdx_id ?? license?.name ?? null;

  if (!value || value === 'NOASSERTION') {
    return null;
  }

  return value;
}

function cleanMarkdownBlock(block: string): string {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'))
    .filter((line) => !line.startsWith('[!['))
    .filter((line) => !line.startsWith('!['));

  return lines
    .map((line) =>
      line
        .replace(/<[^>]*>/g, ' ')
        .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
        .replace(/[`*_]/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join(' ')
    .trim();
}

function truncateExcerpt(excerpt: string): string {
  if (excerpt.length <= MAX_EXCERPT_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, MAX_EXCERPT_LENGTH - 3).trimEnd()}...`;
}

function formatList(items: string[]): string {
  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}
