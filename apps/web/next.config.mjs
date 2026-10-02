/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Folder-style URLs (/items/eclipse/index.html), matching the trailing-slash links, so any static host serves them.
  trailingSlash: true,
  // The workspace packages ship TypeScript source (package.json "main" points at src/*.ts).
  transpilePackages: ['@wr-calc/calc', '@wr-calc/data', '@wr-calc/schema'],
}

export default nextConfig
