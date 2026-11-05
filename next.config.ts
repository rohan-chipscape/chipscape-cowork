import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  serverExternalPackages: ["ffmpeg-static", "pdfkit", "tesseract.js", "pdfjs-dist"],
  // tesseract.js's Node worker thread requires its own sibling files
  // (getCore.js, gunzip.js, cache.js, and the package root via a relative
  // "require('..')") at runtime inside worker_threads — Next's static file
  // tracer can't follow that, so the standalone build's node_modules copy
  // silently drops them, crashing any OCR-triggering upload in production
  // with "Cannot find module". Force the whole package in instead.
  outputFileTracingIncludes: {
    "/api/files/upload/**": ["./node_modules/tesseract.js/**/*"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
