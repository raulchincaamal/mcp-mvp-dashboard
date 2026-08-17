import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  devIndicators: false,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
};

export default nextConfig;

