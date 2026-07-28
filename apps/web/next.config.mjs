import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Prefer the web app's nested React when present; otherwise root (must be 19.2.7 for Next).
const reactPath = path.dirname(
  require.resolve('react/package.json', {
    paths: [path.join(__dirname, 'node_modules'), __dirname],
  }),
);
const reactDomPath = path.dirname(
  require.resolve('react-dom/package.json', {
    paths: [path.join(__dirname, 'node_modules'), __dirname],
  }),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@surveylink/types',
    '@surveylink/validation',
    '@surveylink/api-client',
  ],
  webpack: (config, { isServer }) => {
    // Only dedupe when root React is not the web version (Expo hoist).
    // Aliasing a directory can break Next's own React canary wiring in some setups.
    const rootReactVer = (() => {
      try {
        return require(path.join(reactPath, 'package.json')).version;
      } catch {
        return '';
      }
    })();
    if (rootReactVer.startsWith('19.2')) {
      return config;
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      react$: reactPath,
      react: reactPath,
      'react-dom$': reactDomPath,
      'react-dom': reactDomPath,
      'react/jsx-runtime': path.join(reactPath, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': path.join(reactPath, 'jsx-dev-runtime.js'),
    };
    return config;
  },
};

export default nextConfig;

// Opt-in: OPENNEXT_CLOUDFLARE_DEV=1 pnpm --filter @surveylink/web dev
if (process.env.NODE_ENV !== 'production' && process.env.OPENNEXT_CLOUDFLARE_DEV === '1') {
  void import('@opennextjs/cloudflare').then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}
