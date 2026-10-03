/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_BASE_PATH ?? ''

const nextConfig = {
  output: 'export',
  // Served from a sub-path when hosted without a custom domain (GitHub Pages: /wr-calculator); empty otherwise.
  basePath,
  // Plain <img> tags don't get the base path, so art URLs prefix it themselves (lib/site/art.ts).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Folder-style URLs (/items/eclipse/index.html), matching the trailing-slash links, so any static host serves them.
  trailingSlash: true,
  // The workspace packages ship TypeScript source (package.json "main" points at src/*.ts).
  transpilePackages: ['@wr-calc/calc', '@wr-calc/data', '@wr-calc/schema'],
  // Next 16 otherwise writes AGENTS.md/CLAUDE.md into apps/web on every `next dev`.
  agentRules: false,
}

export default nextConfig
