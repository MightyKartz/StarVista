import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import type { APIRoute, GetStaticPaths } from 'astro';
import React from 'react';
import satori from 'satori';
import { loadManifest } from '../../lib/data';
import type { ManifestRepo } from '../../lib/types';

const width = 1200;
const height = 630;

export const getStaticPaths = (() => {
  const manifest = loadManifest();

  return manifest.repos.map((repo) => ({
    params: { slug: repo.slug },
    props: { repo },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const repo = props.repo;
  const fontRegular = await readFile(
    path.join(
      process.cwd(),
      'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff',
    ),
  );
  const fontBold = await readFile(
    path.join(
      process.cwd(),
      'node_modules/@fontsource/inter/files/inter-latin-800-normal.woff',
    ),
  );
  const svg = await satori(createOgCard(repo), {
    width,
    height,
    fonts: [
      { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fontBold, weight: 800, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

function createOgCard(repo: ManifestRepo) {
  const accent = repo.languageColor ?? '#6ee7b7';
  const language = repo.primaryLanguage ?? 'Repository';

  return React.createElement(
    'div',
    {
      style: {
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#111827',
        color: '#f9fafb',
        padding: 72,
        fontFamily: 'Inter',
        borderLeft: `18px solid ${accent}`,
      },
    },
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
      React.createElement(
        'div',
        { style: { color: '#9ca3af', fontSize: 34, fontWeight: 800 } },
        repo.owner,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: 0,
          },
        },
        repo.name,
      ),
      React.createElement(
        'div',
        {
          style: {
            color: '#d1d5db',
            fontSize: 34,
            lineHeight: 1.35,
            maxWidth: 980,
          },
        },
        repo.description ?? repo.id,
      ),
    ),
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 32,
          fontSize: 28,
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', gap: 18 } },
        tag(language, accent),
        tag(repo.activity, accent),
      ),
      React.createElement(
        'div',
        { style: { color: '#9ca3af', fontWeight: 800 } },
        `${repo.stars.toLocaleString('en')} stars`,
      ),
      React.createElement(
        'div',
        { style: { color: '#6ee7b7', fontWeight: 800 } },
        'StarVista',
      ),
    ),
  );
}

function tag(label: string, accent: string) {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: '1px solid #374151',
        borderRadius: 10,
        background: '#1f2937',
        padding: '10px 14px',
        color: '#f9fafb',
        fontSize: 24,
        fontWeight: 800,
      },
    },
    React.createElement('div', {
      style: {
        width: 10,
        height: 10,
        borderRadius: 999,
        background: accent,
      },
    }),
    label,
  );
}
