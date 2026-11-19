#!/usr/bin/env node
/**
 * Renders the PNG app icons the web manifest and iOS need from the SVG sources.
 *   node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const jobs = [
  { src: "icon.svg", out: "icon-192.png", size: 192 },
  { src: "icon.svg", out: "icon-512.png", size: 512 },
  { src: "maskable.svg", out: "maskable-512.png", size: 512 },
  { src: "maskable.svg", out: "apple-touch-icon.png", size: 180 },
];

for (const job of jobs) {
  await sharp(join(dir, job.src), { density: 384 }).resize(job.size, job.size).png().toFile(join(dir, job.out));
  console.log(`icons/${job.out}`);
}
