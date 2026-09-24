import JSZip from "jszip";
import { MAX_PACK_BYTES, MAX_PACK_FILES } from "./versions";

export interface SafeZipEntry {
  path: string;
  dir: boolean;
  size: number;
  getData: () => Promise<Uint8Array>;
}

export function sanitizeZipPath(raw: string): string | null {
  // Reject absolute, drive-letter, backslash escapes, traversal
  if (!raw) return null;
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;
  const parts = p.split("/");
  const clean: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") return null;
    // Reject dangerous names
    if (part.length > 180) return null;
    clean.push(part);
  }
  if (clean.length === 0) return null;
  const joined = clean.join("/");
  if (joined.length > 512) return null;
  return joined;
}

export async function loadZipSafely(file: File | Blob): Promise<{ entries: SafeZipEntry[]; zip: JSZip }> {
  const buf = await file.arrayBuffer();
  // Hard size cap before parse (500MB)
  if (buf.byteLength > MAX_PACK_BYTES) {
    throw new Error(`File too large (${(buf.byteLength / 1048576).toFixed(1)} MB). Limit is 500 MB.`);
  }
  const zip = await JSZip.loadAsync(buf);
  const paths = Object.keys(zip.files);
  if (paths.length > MAX_PACK_FILES) {
    throw new Error(`Archive has too many entries (${paths.length}). Limit is ${MAX_PACK_FILES}. Possible ZIP bomb — rejected.`);
  }
  const entries: SafeZipEntry[] = [];
  let totalUncompressed = 0;
  for (const raw of paths) {
    const safe = sanitizeZipPath(raw);
    if (!safe) continue; // skip dangerous entries instead of extracting
    const z = zip.files[raw];
    const isDir = z.dir || raw.endsWith("/");
    if (isDir) {
      entries.push({ path: safe, dir: true, size: 0, getData: async () => new Uint8Array() });
      continue;
    }
    // Use internal uncompressed size estimate
    const size = (z as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    totalUncompressed += size;
    // Compression-ratio heuristic: reject >200x blowup on small archives
    if (totalUncompressed > MAX_PACK_BYTES) {
      throw new Error("Uncompressed size exceeds 500 MB. Possible ZIP bomb — rejected.");
    }
    const ref = z;
    entries.push({
      path: safe,
      dir: false,
      size: size,
      getData: async () => new Uint8Array(await ref.async("uint8array")),
    });
  }
  // Sort: dirs first then alpha
  entries.sort((a, b) => (a.dir === b.dir ? a.path.localeCompare(b.path) : a.dir ? -1 : 1));
  return { entries, zip };
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

export function sniffAudio(bytes: Uint8Array): "ogg" | "wav" | "mp3" | "unknown" {
  if (bytes.length > 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";
  if (bytes.length > 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "wav";
  if (bytes.length > 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  if (bytes.length > 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";
  return "unknown";
}
