import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@rsd-sync/configuration',
    '@rsd-sync/contracts',
    '@rsd-sync/shared',
  ],
};

export default nextConfig;
