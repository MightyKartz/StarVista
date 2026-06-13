import { describe, expect, it, vi } from 'vitest';
import type { ManifestRepo } from '../src/lib/types';
import {
  createReadmeHash,
  resolveRepoSummary,
  shouldRequestLlmSummary,
} from '../scripts/lib/summary';
import { createTemplateSummary } from '../scripts/lib/normalize';

const repo: ManifestRepo = {
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
};

describe('createReadmeHash', () => {
  it('creates stable sha256 hashes for README content', () => {
    const hash = createReadmeHash('# Next.js\n\nThe React Framework.');

    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hash).toBe(createReadmeHash('# Next.js\n\nThe React Framework.'));
    expect(hash).not.toBe(createReadmeHash('# Next.js\n\nAnother README.'));
  });

  it('returns null when README content is unavailable', () => {
    expect(createReadmeHash(null)).toBeNull();
  });
});

describe('shouldRequestLlmSummary', () => {
  it('keeps LLM generation off unless an API key and README hash are present', () => {
    expect(shouldRequestLlmSummary(undefined, 'sha256:abc', undefined)).toBe(
      false,
    );
    expect(shouldRequestLlmSummary(undefined, null, 'test-api-key')).toBe(
      false,
    );
    expect(
      shouldRequestLlmSummary(undefined, 'sha256:abc', 'test-api-key'),
    ).toBe(true);
  });

  it('skips duplicate LLM calls when the cached README hash still matches', () => {
    expect(
      shouldRequestLlmSummary(
        { mode: 'llm', text: 'Cached summary.', readmeHash: 'sha256:abc' },
        'sha256:abc',
        'test-api-key',
      ),
    ).toBe(false);
  });
});

describe('resolveRepoSummary', () => {
  it('falls back to the template summary and does not call the API without a key', async () => {
    const fetchImpl = vi.fn();

    await expect(
      resolveRepoSummary({
        repo,
        readmeExcerpt: 'Next.js is a React framework.',
        readmeHash: 'sha256:abc',
        apiKey: undefined,
        fetchImpl,
      }),
    ).resolves.toEqual(createTemplateSummary(repo));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reuses a cached LLM summary when the README hash is unchanged', async () => {
    const cached = {
      mode: 'llm' as const,
      text: 'Cached summary.',
      readmeHash: 'sha256:abc',
    };
    const fetchImpl = vi.fn();

    await expect(
      resolveRepoSummary({
        repo,
        readmeExcerpt: 'Next.js is a React framework.',
        readmeHash: 'sha256:abc',
        existingSummary: cached,
        apiKey: 'test-api-key',
        fetchImpl,
      }),
    ).resolves.toEqual(cached);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates an AI summary and stores the README hash when generation is enabled', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ output_text: ' Next.js is a React framework. ' }),
    );

    await expect(
      resolveRepoSummary({
        repo,
        readmeExcerpt: 'Next.js is a React framework.',
        readmeHash: 'sha256:abc',
        apiKey: 'test-api-key',
        model: 'gpt-5.5',
        fetchImpl,
      }),
    ).resolves.toEqual({
      mode: 'llm',
      text: 'Next.js is a React framework.',
      readmeHash: 'sha256:abc',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
