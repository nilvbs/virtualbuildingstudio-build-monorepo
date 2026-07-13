/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile shared workspace packages through Next's build pipeline.
  transpilePackages: [
    '@surveylink/types',
    '@surveylink/validation',
    '@surveylink/api-client',
  ],
};

export default nextConfig;
