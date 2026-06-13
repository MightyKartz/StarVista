import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://mightykartz.github.io',
  base: '/StarVista/',
  integrations: [react(), sitemap()],
});
