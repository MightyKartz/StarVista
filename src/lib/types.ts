export type Activity =
  | 'archived'
  | 'fast-rising'
  | 'active'
  | 'stable'
  | 'cooling';

export interface Manifest {
  generatedAt: string;
  repoCount: number;
  repos: ManifestRepo[];
}

export interface ManifestRepo {
  id: string;
  slug: string;
  owner: string;
  name: string;
  description: string | null;
  archived: boolean;
  primaryLanguage: string | null;
  languageColor: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  pushedAt: string | null;
  topics: string[];
  license: string | null;
  activity: Activity;
  starDelta7d: number | null;
  ownerAvatarUrl: string | null;
}

export interface RepoDetails extends ManifestRepo {
  languages: Record<string, number>;
  readmeExcerpt: string | null;
  summary: RepoSummary;
  releases: RepoRelease[];
  starHistory: StarHistoryPoint[];
  links: RepoLinks;
}

export interface RepoSummary {
  mode: 'template' | 'llm';
  text: string;
}

export interface RepoRelease {
  tag: string;
  name: string | null;
  publishedAt: string | null;
}

export interface StarHistoryPoint {
  date: string;
  stars: number;
}

export interface RepoLinks {
  repo: string;
  homepage: string | null;
}

export interface Snapshot {
  date: string;
  repos: Record<string, SnapshotRepo>;
}

export interface SnapshotRepo {
  stars: number;
  forks: number;
  openIssues: number;
}
