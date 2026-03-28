/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  transpilePackages: ['@dojak/ui'],
  experimental: {
    optimizePackageImports: ['@dojak/ui']
  }
};

export default nextConfig;
