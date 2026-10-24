const nextConfig = {
  distDir: process.env.YIBAN_NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['node:sqlite'],
  devIndicators: false,
};
export default nextConfig;
