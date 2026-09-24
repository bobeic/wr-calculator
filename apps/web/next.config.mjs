/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // The workspace packages ship TypeScript source (package.json "main" points at src/*.ts).
  transpilePackages: ['@wr-calc/calc', '@wr-calc/data', '@wr-calc/schema'],
}

export default nextConfig
