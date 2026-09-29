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

const isDev = process.env.NODE_ENV !== 'production';

function originOf(url) {
  try {
    return url ? new URL(url).origin : '';
  } catch {
    return '';
  }
}

/**
 * Next App Router streams inline bootstrap scripts, so script-src keeps
 * 'unsafe-inline'. Everything else is locked to the hosts the app uses.
 * Session tokens are httpOnly cookies, so script access cannot read them.
 */
function contentSecurityPolicy() {
  const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
  const mapbox = ['https://api.mapbox.com', 'https://events.mapbox.com', 'https://*.tiles.mapbox.com'];
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'", 'https://api.mapbox.com'],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.amazonaws.com',
      'https://images.unsplash.com',
      ...mapbox,
    ],
    'font-src': ["'self'", 'data:'],
    'connect-src': [
      "'self'",
      apiOrigin,
      ...mapbox,
      'https://cdn.lordicon.com',
      'https://nominatim.openstreetmap.org',
      'https://tigerweb.geo.census.gov',
      'https://*.amazonaws.com',
      ...(isDev ? ['ws:', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
    ].filter(Boolean),
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
    'media-src': ["'self'", 'blob:', 'https://*.amazonaws.com'],
    'frame-src': ["'self'", 'https://*.amazonaws.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
  },
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
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
