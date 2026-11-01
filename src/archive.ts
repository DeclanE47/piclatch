import { zipSync } from "fflate";
import { filename, type ImageItem } from "./core";

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;

export function archiveName(image: ImageItem, mime: string, used: Set<string>) {
  let name = filename(image.url);
  const extension: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
  };
  if (!/\.(png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?)$/i.test(name))
    name += "." + (extension[mime.split(";")[0]] || "img");
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const suffix = dot > 0 ? name.slice(dot) : "";
  let candidate = name,
    index = 2;
  while (used.has(candidate.toLowerCase()))
    candidate = stem + " (" + index++ + ")" + suffix;
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function imageBytes(
  response: Response,
  signal: AbortSignal,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!response.ok)
    throw Error("Image server returned HTTP " + response.status + ".");
  const mime = response.headers.get("content-type")?.split(";")[0] || "";
  if (!mime.startsWith("image/"))
    throw Error("The server did not return an image.");
  if (Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES)
    throw Error("Image exceeds the 50 MB limit.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Image response is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) throw Error("Image exceeds the 50 MB limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes, mime };
}

export async function buildArchive(
  images: ImageItem[],
  read: (
    image: ImageItem,
    signal: AbortSignal,
  ) => Promise<{ bytes: Uint8Array; mime: string }>,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  if (images.length > 2000) throw Error("Select up to 2,000 images per ZIP.");
  const entries: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  const failed: { image: ImageItem; error: string }[] = [];
  let size = 0,
    done = 0,
    index = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, images.length) }, async () => {
      while (index < images.length) {
        signal.throwIfAborted();
        const image = images[index++];
        try {
          const data = await read(image, signal);
          signal.throwIfAborted();
          if (size + data.bytes.length > MAX_ARCHIVE_BYTES)
            throw Error(
              "ZIP source files exceed the 250 MB limit. Select fewer images.",
            );
          size += data.bytes.length;
          entries[archiveName(image, data.mime, used)] = data.bytes;
        } catch (e) {
          signal.throwIfAborted();
          failed.push({ image, error: (e as Error).message });
        }
        progress(++done, images.length);
      }
    }),
  );
  signal.throwIfAborted();
  const count = Object.keys(entries).length;
  if (!count) throw Error(failed[0]?.error || "No images could be downloaded.");
  // Store original bytes without recompressing already-compressed image formats.
  const bytes = zipSync(entries, { level: 0 });
  return { bytes, count, failed };
}
