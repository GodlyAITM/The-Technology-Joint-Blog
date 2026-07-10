process.env.DEBUG = 'astro:*,vite:*';
import('./node_modules/astro/bin/astro.mjs').catch((e) => {
  console.error('astro import failed:', e);
  process.exit(1);
});
