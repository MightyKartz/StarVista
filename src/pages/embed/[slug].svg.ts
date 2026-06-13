import type { APIRoute, GetStaticPaths } from 'astro';
import { loadManifest } from '../../lib/data';
import { parseEmbedSlug, projectRepo, renderSvgCard } from '../../lib/embed';

export const getStaticPaths = (() => {
  const manifest = loadManifest();
  const repos = [projectRepo, ...manifest.repos];

  return repos.flatMap((repo) => [
    { params: { slug: repo.slug }, props: { repo } },
    { params: { slug: `${repo.slug}-dark` }, props: { repo } },
  ]);
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, props }) => {
  const { theme } = parseEmbedSlug(params.slug ?? '');
  const svg = renderSvgCard(props.repo, { theme });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
