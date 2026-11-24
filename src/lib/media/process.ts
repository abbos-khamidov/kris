"use client";

/**
 * Client-side image pipeline: HEIC/HEIF -> JPEG, orientation fix, crop/rotate, downscale and re-encode.
 * Re-encoding through a canvas drops ALL metadata (EXIF, GPS, camera info) — required for exported images.
 * No filters, retouching or enhancement of skin photos is ever applied.
 */

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.86;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  contentType: "image/jpeg" | "image/png";
}

const isHeic = (f: File) => /hei[cf]$/i.test(f.name) || /hei[cf]/.test(f.type);

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_INPUT_BYTES) return "Файл больше 40 МБ";
  if (!ACCEPTED_TYPES.includes(file.type) && !isHeic(file)) return "Допустимы JPEG, PNG, WebP и HEIC/HEIF";
  return null;
}

/** Returns a browser-decodable blob (converting HEIC when needed). */
export async function toDecodable(file: File): Promise<Blob> {
  if (!isHeic(file)) return file;
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  // imageOrientation: "from-image" applies the EXIF rotation so the pixels are upright before metadata is dropped.
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function encode(canvas: HTMLCanvasElement, png: boolean): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось сохранить изображение"))), png ? "image/png" : "image/jpeg", png ? undefined : JPEG_QUALITY),
  );
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Applies rotation (degrees, multiples of 90 or free) and a crop rectangle expressed in the coordinate
 * space of the *rotated* image (the format react-easy-crop returns as `croppedAreaPixels`).
 */
export async function processImage(
  source: Blob,
  opts: { crop?: CropArea; rotation?: number; keepPng?: boolean; maxEdge?: number } = {},
): Promise<ProcessedImage> {
  const bmp = await decode(source);
  const rot = (((opts.rotation ?? 0) % 360) + 360) % 360;
  const rad = (rot * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const rw = bmp.width * cos + bmp.height * sin;
  const rh = bmp.width * sin + bmp.height * cos;

  const full = document.createElement("canvas");
  full.width = Math.round(rw);
  full.height = Math.round(rh);
  const fctx = full.getContext("2d")!;
  fctx.translate(full.width / 2, full.height / 2);
  fctx.rotate(rad);
  fctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close();

  const crop = opts.crop ?? { x: 0, y: 0, width: full.width, height: full.height };
  const max = opts.maxEdge ?? MAX_EDGE;
  const scale = Math.min(1, max / Math.max(crop.width, crop.height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(crop.width * scale));
  out.height = Math.max(1, Math.round(crop.height * scale));
  const octx = out.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  // JPEG has no alpha: flatten onto white.
  const png = !!opts.keepPng;
  if (!png) {
    octx.fillStyle = "#fff";
    octx.fillRect(0, 0, out.width, out.height);
  }
  octx.drawImage(full, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);

  const blob = await encode(out, png);
  return { blob, width: out.width, height: out.height, contentType: png ? "image/png" : "image/jpeg" };
}

/** Fast path for uploads without cropping: decode, fix orientation, downscale, strip metadata. */
export async function optimizeFile(file: File, keepPng = false): Promise<ProcessedImage> {
  const err = validateImageFile(file);
  if (err) throw new Error(err);
  const decodable = await toDecodable(file);
  return processImage(decodable, { keepPng: keepPng && file.type === "image/png" });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
