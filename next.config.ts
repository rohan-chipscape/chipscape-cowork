import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  serverExternalPackages: ["ffmpeg-static", "pdfkit", "tesseract.js", "pdfjs-dist", "@napi-rs/canvas"],
  // tesseract.js's Node worker thread requires its own sibling files
  // (getCore.js, gunzip.js, cache.js, the package root via a relative
  // "require('..')") AND its own top-level dependencies (bmp-js,
  // tesseract.js-core, etc.) at runtime inside worker_threads — Next's
  // static file tracer can't follow any of that, so the standalone build's
  // node_modules copy silently drops them, crashing any OCR-triggering
  // upload in production with "Cannot find module". Force everything in.
  outputFileTracingIncludes: {
    "/api/files/upload/**": [
      // pdfjs-dist (used by pdf-parse for plain PDF text extraction) loads
      // its worker script by computing a path at runtime — the tracer only
      // found 1 of its 387 files, missing pdf.worker.mjs entirely, so every
      // PDF upload failed with "Cannot find module ... pdf.worker.mjs".
      "./node_modules/pdfjs-dist/**/*",
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
      // pdf-parse's own getText() needs @napi-rs/canvas just to provide a
      // DOMMatrix polyfill for pdfjs-dist, even for plain text extraction
      // with no rendering — without it, every PDF upload throws
      // "DOMMatrix is not defined". Its platform-specific native binary
      // package (one of these per OS/arch, resolved by npm at install
      // time) needs the same force-include treatment as the JS-only deps.
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
    ],
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
