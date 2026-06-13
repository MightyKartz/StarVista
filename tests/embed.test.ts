import { describe, expect, it } from 'vitest';
import {
  createEmbedMarkdown,
  parseEmbedSlug,
  renderSvgCard,
} from '../src/lib/embed';
import type { ManifestRepo } from '../src/lib/types';

const repo: ManifestRepo = {
  id: 'owner/project',
  slug: 'owner-project',
  owner: 'owner',
  name: 'project',
  description: 'A <visual> repository & discovery card',
  archived: false,
  primaryLanguage: 'TypeScript',
  languageColor: '#3178c6',
  stars: 12_345,
  forks: 678,
  openIssues: 9,
  pushedAt: '2026-06-13T00:00:00Z',
  topics: ['visualization', 'github'],
  license: 'MIT',
  activity: 'active',
  starDelta7d: 321,
  ownerAvatarUrl: null,
};

describe('parseEmbedSlug', () => {
  it('keeps plain slugs light by default', () => {
    expect(parseEmbedSlug('owner-project')).toEqual({
      slug: 'owner-project',
      theme: 'light',
    });
  });

  it('uses the dark theme for -dark slugs', () => {
    expect(parseEmbedSlug('owner-project-dark')).toEqual({
      slug: 'owner-project',
      theme: 'dark',
    });
  });
});

describe('renderSvgCard', () => {
  it('renders a self-contained escaped SVG card under thirty kilobytes', () => {
    const svg = renderSvgCard(repo, { theme: 'light' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('owner/project');
    expect(svg).toContain('12.3K');
    expect(svg).toContain('A &lt;visual&gt; repository &amp; discovery card');
    expect(svg.length).toBeLessThan(30 * 1024);
  });

  it('renders a dark variant with dark theme colors', () => {
    const svg = renderSvgCard(repo, { theme: 'dark' });

    expect(svg).toContain('#111827');
    expect(svg).toContain('active');
  });
});

describe('createEmbedMarkdown', () => {
  it('creates a GitHub README-safe markdown image link', () => {
    expect(
      createEmbedMarkdown(repo, 'https://mightykartz.github.io/StarVista/'),
    ).toBe(
      '[![owner/project StarVista card](https://mightykartz.github.io/StarVista/embed/owner-project.svg)](https://github.com/owner/project)',
    );
  });
});
