import type { NextConfig } from "next";

// pdf-parse (used both for uploaded PDFs and now for PDF links the agent
// fetches) depends on pdfjs-dist + @napi-rs/canvas at runtime in ways Next's
// static file tracer can't follow on its own — see the comments below.
// extractTextFromBuffer (lib/files/extract.ts) is now called from two
// routes — uploads AND web_fetch reading a linked file — so both need the
// exact same force-included dependencies, or whichever route goes down the
// path these comments explain first will crash with "Cannot find module" /
// "DOMMatrix is not defined" in production.
const FILE_EXTRACTION_TRACING_INCLUDES = [
  // pdfjs-dist loads its worker script by computing a path at runtime — the
  // tracer only found 1 of its 387 files, missing pdf.worker.mjs entirely,
  // so every PDF read failed with "Cannot find module ... pdf.worker.mjs".
  "./node_modules/pdfjs-dist/**/*",
  // pdf-parse's own getText() needs @napi-rs/canvas just to provide a
  // DOMMatrix polyfill for pdfjs-dist, even for plain text extraction with
  // no rendering — without it, every PDF read throws "DOMMatrix is not
  // defined". Its platform-specific native binary package (one of these per
  // OS/arch, resolved by npm at install time) needs the same treatment.
  "./node_modules/@napi-rs/canvas/**/*",
  "./node_modules/@napi-rs/canvas-*/**/*",
  // tesseract.js's Node worker thread requires its own sibling files
  // (getCore.js, gunzip.js, cache.js, the package root via a relative
  // "require('..')") AND its own top-level dependencies (bmp-js,
  // tesseract.js-core, etc.) at runtime inside worker_threads — none of
  // which the static tracer can follow.
  "./node_modules/tesseract.js/**/*",
  "./node_modules/bmp-js/**/*",
  "./node_modules/idb-keyval/**/*",
  "./node_modules/is-url/**/*",
  "./node_modules/node-fetch/**/*",
  "./node_modules/opencollective-postinstall/**/*",
  "./node_modules/regenerator-runtime/**/*",
  "./node_modules/tesseract.js-core/**/*",
  "./node_modules/wasm-feature-detect/**/*",
  "./node_modules/zlibjs/**/*",
  // heic-convert decodes an iPhone .heic/.heif photo to JPEG via
  // libheif-js, which loads a ~2MB libheif.wasm file by computing a path at
  // runtime — same untraceable pattern as pdfjs-dist's worker above.
  "./node_modules/heic-convert/**/*",
  "./node_modules/heic-decode/**/*",
  "./node_modules/libheif-js/**/*",
  "./node_modules/jpeg-js/**/*",
];

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  serverExternalPackages: [
    "ffmpeg-static",
    "pdfkit",
    "tesseract.js",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "heic-convert",
    "heic-decode",
    "libheif-js",
  ],
  // Next's static file tracer can't follow any of the runtime-computed
  // require()s these packages do, so the standalone build's node_modules
  // copy silently drops them, crashing in production with "Cannot find
  // module" — force everything in for both routes that call
  // extractTextFromBuffer.
  outputFileTracingIncludes: {
    "/api/files/upload/**": FILE_EXTRACTION_TRACING_INCLUDES,
    "/api/agent/execute/**": FILE_EXTRACTION_TRACING_INCLUDES,
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // proxy.ts (our auth check) buffers the request body to let both it and
    // the route handler read it; Next.js defaults that buffer to 10MB and
    // silently truncates anything bigger instead of erroring, which
    // corrupted the multipart body mid-boundary and surfaced as a confusing
    // "Failed to parse body as FormData" crash in the upload route itself.
    // Match the app's own 512MB upload limit.
    proxyClientMaxBodySize: "512mb",
  },
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
