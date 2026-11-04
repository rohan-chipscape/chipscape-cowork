import { randomUUID } from "crypto";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";

// Shared storage for anything the agent generates and hands back as a
// download (PDFs from create_document, images from generate_image) — one
// file per id, named "<id>.<ext>" so the download route can serve the right
// Content-Type for whichever kind it is.
const FILES_DIR = path.join(process.cwd(), ".data", "files");

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function ensureDir() {
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });
}

export function sanitizeFilename(title: string): string {
  const base = title.trim().replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "File";
  return base.slice(0, 80);
}

export function saveGeneratedFile(buffer: Buffer, ext: string): { id: string; ext: string } {
  ensureDir();
  const id = randomUUID();
  writeFileSync(path.join(FILES_DIR, `${id}.${ext}`), buffer);
  return { id, ext };
}

export function getGeneratedFile(id: string): { path: string; contentType: string } | null {
  // id comes straight from the URL param — reject anything that isn't a bare
  // UUID before it ever touches the filesystem, so no path traversal is possible.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  ensureDir();
  const match = readdirSync(FILES_DIR).find((f) => f.startsWith(`${id}.`));
  if (!match) return null;
  const ext = match.split(".").pop() ?? "";
  return {
    path: path.join(FILES_DIR, match),
    contentType: CONTENT_TYPES[ext] ?? "application/octet-stream",
  };
}
