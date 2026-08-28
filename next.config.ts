import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "t3.ftcdn.net" },
      { protocol: "https", hostname: "t4.ftcdn.net" },
    ],
  },
  async headers() {
    // Security baseline per NGF-STANDARDS §. ONE Content-Security-Policy entry
    // with frame-ancestors merged in — Next.js emits last-write-wins, so a second
    // CSP header would silently destroy the first. Square's Web Payments SDK needs
    // its CDN in script/frame/font-src and its API in connect-src, or the hosted
    // card iframes fail to load and tokenization is blocked. Both sandbox and
    // production Square origins are listed so the same policy works in either env.
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://js.squareup.com https://js.squareupsandbox.com",
              "style-src 'self' 'unsafe-inline' https://web.squarecdn.com https://sandbox.web.squarecdn.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://square-fonts-production-f.squarecdn.com https://web.squarecdn.com https://sandbox.web.squarecdn.com",
              "connect-src 'self' https://connect.squareup.com https://connect.squareupsandbox.com https://pci-connect.squareup.com https://pci-connect.squareupsandbox.com https://web.squarecdn.com https://sandbox.web.squarecdn.com https://o160250.ingest.sentry.io https://app.ngfsystems.com",
              "frame-src 'self' https://web.squarecdn.com https://sandbox.web.squarecdn.com https://connect.squareup.com https://connect.squareupsandbox.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self' https://app.ngfsystems.com https://*.vercel.app",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
