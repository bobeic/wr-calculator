/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Served from a sub-path when hosted without a custom domain (GitHub Pages: /wr-calculator); empty otherwise.
  basePath: process.env.NEXT_BASE_PATH ?? '',
  // Folder-style URLs (/items/eclipse/index.html), matching the trailing-slash links, so any static host serves them.
  trailingSlash: true,
  // The workspace packages ship TypeScript source (package.json "main" points at src/*.ts).
  transpilePackages: ['@wr-calc/calc', '@wr-calc/data', '@wr-calc/schema'],
  // Next 16 otherwise writes AGENTS.md/CLAUDE.md into apps/web on every `next dev`.
  agentRules: false,
}

export default nextConfig
