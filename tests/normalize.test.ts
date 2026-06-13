import { describe, expect, it } from 'vitest';
import {
  createTemplateSummary,
  extractReadmeExcerpt,
  normalizeLanguages,
  normalizeManifestRepo,
  slugFromRepoId,
} from '../scripts/lib/normalize';

const searchRepo = {
  full_name: 'vercel/next.js',
  name: 'next.js',
  owner: {
    login: 'vercel',
    avatar_url: 'https://avatars.githubusercontent.com/u/14985020?v=4',
  },
  description: 'The React Framework',
  archived: false,
  language: 'TypeScript',
  stargazers_count: 128_000,
  forks_count: 27_000,
  open_issues_count: 2_900,
  pushed_at: '2026-06-12T18:00:00Z',
  topics: ['react', 'framework'],
  license: {
    spdx_id: 'MIT',
    name: 'MIT License',
  },
};
const now = new Date('2026-06-13T12:00:00Z');

describe('slugFromRepoId', () => {
  it('converts owner/name repository ids into stable URL slugs', () => {
    expect(slugFromRepoId('vercel/next.js')).toBe('vercel-next.js');
  });
});

describe('normalizeManifestRepo', () => {
  it('maps GitHub search results into the manifest repository contract', () => {
    expect(normalizeManifestRepo(searchRepo, now)).toEqual({
      id: 'vercel/next.js',
      slug: 'vercel-next.js',
      owner: 'vercel',
      name: 'next.js',
      description: 'The React Framework',
      archived: false,
      primaryLanguage: 'TypeScript',
      languageColor: '#3178c6',
      stars: 128_000,
      forks: 27_000,
      openIssues: 2_900,
      pushedAt: '2026-06-12T18:00:00Z',
      topics: ['react', 'framework'],
      license: 'MIT',
      activity: 'active',
      starDelta7d: null,
      ownerAvatarUrl: 'https://avatars.githubusercontent.com/u/14985020?v=4',
    });
  });

  it('normalizes unavailable SPDX license values to null', () => {
    const repo = normalizeManifestRepo(
      {
        ...searchRepo,
        license: {
          spdx_id: 'NOASSERTION',
          name: 'Other',
        },
      },
      now,
    );

    expect(repo.license).toBeNull();
  });
});

describe('normalizeLanguages', () => {
  it('converts language byte counts into descending two-decimal ratios', () => {
    expect(
      normalizeLanguages({ TypeScript: 620, JavaScript: 250, Rust: 130 }),
    ).toEqual({
      TypeScript: 0.62,
      JavaScript: 0.25,
      Rust: 0.13,
    });
  });

  it('returns an empty object when no language bytes are available', () => {
    expect(normalizeLanguages({})).toEqual({});
  });
});

describe('extractReadmeExcerpt', () => {
  it('uses the first meaningful markdown paragraph without badges or html', () => {
    const markdown = `
# Project

[![Build](https://img.shields.io/badge/build-passing-green)](https://example.com)

<p align="center"><img src="logo.png" /></p>

Next.js is a React framework for building full-stack web applications.

## Install
`;

    expect(extractReadmeExcerpt(markdown)).toBe(
      'Next.js is a React framework for building full-stack web applications.',
    );
  });

  it('limits excerpts to five hundred characters', () => {
    const excerpt = extractReadmeExcerpt(`A${'b'.repeat(700)}`);

    expect(excerpt).toHaveLength(500);
    expect(excerpt?.endsWith('...')).toBe(true);
  });
});

describe('createTemplateSummary', () => {
  it('creates a deterministic non-LLM project summary', () => {
    expect(
      createTemplateSummary(normalizeManifestRepo(searchRepo, now)),
    ).toEqual({
      mode: 'template',
      text: 'next.js is a TypeScript project focused on The React Framework. It is tagged with react and framework.',
    });
  });
});
