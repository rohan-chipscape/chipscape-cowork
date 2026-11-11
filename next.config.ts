import type { NextConfig } from "next";

// pdf-parse (used both for uploaded PDFs and now for PDF links the agent
// fetches) depends on pdfjs-dist + @napi-rs/canvas at runtime in ways Next's
// static file tracer can't follow on its own — see the comments below.
const PDF_PARSE_TRACING_INCLUDES = [
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
  // tesseract.js's Node worker thread requires its own sibling files
  // (getCore.js, gunzip.js, cache.js, the package root via a relative
  // "require('..')") AND its own top-level dependencies (bmp-js,
  // tesseract.js-core, etc.) at runtime inside worker_threads — Next's
  // static file tracer can't follow any of that, so the standalone build's
  // node_modules copy silently drops them, crashing any OCR-triggering
  // upload in production with "Cannot find module". Force everything in.
  outputFileTracingIncludes: {
    "/api/files/upload/**": [
      ...PDF_PARSE_TRACING_INCLUDES,
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
      // libheif-js, which loads a ~2MB libheif.wasm file by computing a
      // path at runtime — same untraceable pattern as pdfjs-dist's worker
      // and tesseract.js's worker above, so it needs the same force-include.
      "./node_modules/heic-convert/**/*",
      "./node_modules/heic-decode/**/*",
      "./node_modules/libheif-js/**/*",
      "./node_modules/jpeg-js/**/*",
    ],
    // web_fetch now parses a linked PDF with the same pdf-parse path as an
    // uploaded one — this route needs the same force-included files, or it
    // hits the exact same "Cannot find module"/"DOMMatrix is not defined"
    // crashes the upload route did before it got this treatment.
    "/api/agent/execute/**": PDF_PARSE_TRACING_INCLUDES,
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
