import "server-only";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { PayloadTooLargeError, UnsupportedMediaTypeError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_EDGE = 1600;

// Decided by the file's magic bytes, never by its name or the client's Content-Type.
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export type ProcessedImage = { data: Buffer; width: number; height: number; mimeType: "image/webp" };

/**
 * Re-encodes an upload to WebP (ADR-011). Re-encoding drops every byte that
 * is not pixel data: EXIF (including GPS location), embedded scripts and
 * polyglot payloads. SVG and GIF are rejected outright.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new PayloadTooLargeError("Images must be 4 MB or smaller. Try a smaller photo.");
  }

  const type = await fileTypeFromBuffer(input);
  if (!type || !ACCEPTED.has(type.mime)) {
    throw new UnsupportedMediaTypeError("Only JPEG, PNG, WebP and AVIF images are accepted.");
  }

  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // apply the camera orientation before the metadata is dropped
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, mimeType: "image/webp" };
  } catch {
    throw new UnsupportedMediaTypeError("This image could not be read. It may be corrupted or too large.");
  }
}
