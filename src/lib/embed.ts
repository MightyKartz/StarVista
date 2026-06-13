import type { ManifestRepo } from './types';

export type EmbedTheme = 'light' | 'dark';

const CARD_WIDTH = 760;
const CARD_HEIGHT = 300;
const numberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const projectRepo: ManifestRepo = {
  id: 'MightyKartz/StarVista',
  slug: 'starvista',
  owner: 'MightyKartz',
  name: 'StarVista',
  description:
    'Visual discovery cards and project stories for notable GitHub repositories.',
  archived: false,
  primaryLanguage: 'TypeScript',
  languageColor: '#3178c6',
  stars: 0,
  forks: 0,
  openIssues: 0,
  pushedAt: null,
  topics: ['github', 'open-source', 'visualization'],
  license: 'MIT',
  activity: 'active',
  starDelta7d: null,
  ownerAvatarUrl: null,
};

const themes = {
  light: {
    background: '#ffffff',
    panel: '#f7f8fa',
    border: '#dfe4ea',
    text: '#18202a',
    muted: '#697684',
    badge: '#eef2f6',
  },
  dark: {
    background: '#111827',
    panel: '#1f2937',
    border: '#374151',
    text: '#f9fafb',
    muted: '#9ca3af',
    badge: '#243244',
  },
} satisfies Record<EmbedTheme, Record<string, string>>;

export function parseEmbedSlug(slug: string): {
  slug: string;
  theme: EmbedTheme;
} {
  if (slug.endsWith('-dark')) {
    return { slug: slug.slice(0, -5), theme: 'dark' };
  }

  return { slug, theme: 'light' };
}

export function renderSvgCard(
  repo: ManifestRepo,
  options: { theme: EmbedTheme },
): string {
  const theme = themes[options.theme];
  const accent = repo.languageColor ?? '#6ee7b7';
  const descriptionLines = wrapText(
    repo.description ?? 'No repository description available.',
    68,
    2,
  );
  const topics = repo.topics.slice(0, 3);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-label="${escapeXml(repo.id)} StarVista card">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="18" fill="${theme.background}" />
  <rect x="1" y="1" width="${CARD_WIDTH - 2}" height="${CARD_HEIGHT - 2}" rx="17" fill="none" stroke="${theme.border}" />
  <rect x="0" y="0" width="10" height="${CARD_HEIGHT}" fill="${accent}" />
  <text x="34" y="46" fill="${theme.muted}" font-family="${fontStack()}" font-size="18" font-weight="700">${escapeXml(repo.owner)}</text>
  <text x="34" y="88" fill="${theme.text}" font-family="${fontStack()}" font-size="36" font-weight="800">${escapeXml(truncate(repo.name, 28))}</text>
  <text x="34" y="124" fill="${theme.muted}" font-family="${fontStack()}" font-size="18">${escapeXml(repo.id)}</text>
  ${descriptionLines.map((line, index) => `<text x="34" y="${158 + index * 27}" fill="${theme.text}" font-family="${fontStack()}" font-size="20">${escapeXml(line)}</text>`).join('\n  ')}
  ${metric(34, 220, 'Stars', numberFormatter.format(repo.stars), theme)}
  ${metric(178, 220, 'Forks', numberFormatter.format(repo.forks), theme)}
  ${metric(322, 220, 'Issues', numberFormatter.format(repo.openIssues), theme)}
  ${badge(500, 218, repo.primaryLanguage ?? 'Repository', accent, theme)}
  ${badge(500, 254, repo.activity, accent, theme)}
  ${topics.map((topic, index) => badge(34 + index * 150, 254, topic, accent, theme)).join('\n  ')}
  <text x="${CARD_WIDTH - 34}" y="${CARD_HEIGHT - 26}" fill="${theme.muted}" font-family="${fontStack()}" font-size="15" text-anchor="end">StarVista</text>
</svg>`;
}

export function createEmbedMarkdown(
  repo: ManifestRepo,
  siteUrl: string,
): string {
  const baseUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  return `[![${repo.id} StarVista card](${baseUrl}embed/${repo.slug}.svg)](https://github.com/${repo.id})`;
}

export function createOgImageUrl(repo: ManifestRepo, siteUrl: string): string {
  const baseUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  return `${baseUrl}og/${repo.slug}.png`;
}

function metric(
  x: number,
  y: number,
  label: string,
  value: string,
  theme: (typeof themes)[EmbedTheme],
): string {
  return `<g>
    <text x="${x}" y="${y}" fill="${theme.text}" font-family="${fontStack()}" font-size="24" font-weight="800">${escapeXml(value)}</text>
    <text x="${x}" y="${y + 26}" fill="${theme.muted}" font-family="${fontStack()}" font-size="14" font-weight="700">${escapeXml(label.toUpperCase())}</text>
  </g>`;
}

function badge(
  x: number,
  y: number,
  label: string,
  accent: string,
  theme: (typeof themes)[EmbedTheme],
): string {
  const width = Math.min(Math.max(label.length * 8 + 30, 76), 140);
  return `<g>
    <rect x="${x}" y="${y - 22}" width="${width}" height="28" rx="7" fill="${theme.badge}" stroke="${theme.border}" />
    <circle cx="${x + 14}" cy="${y - 8}" r="4" fill="${accent}" />
    <text x="${x + 25}" y="${y - 3}" fill="${theme.text}" font-family="${fontStack()}" font-size="13" font-weight="700">${escapeXml(truncate(label, 15))}</text>
  </g>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function wrapText(
  value: string,
  maxLineLength: number,
  maxLines: number,
): string[] {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  let remaining = normalized;

  while (remaining.length > 0 && lines.length < maxLines) {
    if (remaining.length <= maxLineLength) {
      lines.push(remaining);
      break;
    }

    const candidate = remaining.slice(0, maxLineLength + 1);
    const wordBreak = candidate.lastIndexOf(' ');
    const cut =
      wordBreak > Math.floor(maxLineLength * 0.55) ? wordBreak : maxLineLength;
    let line = remaining.slice(0, cut).trimEnd();
    remaining = remaining.slice(cut).trimStart();

    if (lines.length === maxLines - 1 && remaining.length > 0) {
      line = truncate(`${line} ${remaining}`, maxLineLength);
      remaining = '';
    }

    lines.push(line);
  }

  return lines;
}

function fontStack(): string {
  return 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
}
