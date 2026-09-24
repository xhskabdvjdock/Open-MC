import { sniffAudio } from "./zip-safety";

export interface OptimizerFinding {
  kind: "duplicate" | "large-texture" | "invalid" | "unnecessary" | "broken-json";
  file: string;
  detail: string;
  bytes: number;
  fixable: boolean;
}

export interface OptimizeResult {
  findings: OptimizerFinding[];
  totalBytes: number;
  reclaimableBytes: number;
}

// FNV-1a hash for duplicate detection (fast, sync)
export function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export async function analyzePack(
  files: { path: string; size: number; bytes: () => Promise<Uint8Array>; text: () => Promise<string> }[]
): Promise<OptimizeResult> {
  const findings: OptimizerFinding[] = [];
  let total = 0;
  const byHash = new Map<string, string[]>();

  for (const f of files) {
    if (f.path.endsWith("/")) continue;
    total += f.size;
    const lower = f.path.toLowerCase();
    // Unnecessary files
    if (lower.endsWith(".ds_store") || lower.includes("__macosx") || lower.endsWith("thumbs.db") || lower.endsWith(".bak") || lower.endsWith("~")) {
      findings.push({ kind: "unnecessary", file: f.path, detail: "OS/editor leftover — safe to remove.", bytes: f.size, fixable: true });
      continue;
    }
    if (f.size === 0) {
      findings.push({ kind: "unnecessary", file: f.path, detail: "Empty file.", bytes: 0, fixable: true });
      continue;
    }
    // Broken JSON
    if (lower.endsWith(".json")) {
      try {
        const t = await f.text();
        JSON.parse(t);
      } catch (e) {
        findings.push({ kind: "broken-json", file: f.path, detail: e instanceof Error ? e.message : "Invalid JSON", bytes: f.size, fixable: false });
      }
    }
    // Large textures
    if (lower.endsWith(".png") && f.size > 1024 * 1024) {
      findings.push({ kind: "large-texture", file: f.path, detail: `Large texture (${(f.size / 1048576).toFixed(2)} MB). Consider resizing or quantizing.`, bytes: f.size, fixable: false });
    }
    // Invalid audio sniff
    if (/\.(ogg|wav|mp3)$/i.test(f.path)) {
      try {
        const b = await f.bytes();
        const kind = sniffAudio(b);
        const ext = lower.split(".").pop();
        if ((ext === "ogg" && kind !== "ogg") || (ext === "wav" && kind !== "wav")) {
          findings.push({ kind: "invalid", file: f.path, detail: `Extension .${ext} does not match detected format (${kind}).`, bytes: f.size, fixable: false });
        }
      } catch { /* ignore */ }
    }
    // Duplicate detection
    try {
      if (f.size < 20 * 1024 * 1024) {
        const b = await f.bytes();
        const h = hashBytes(b) + ":" + f.size;
        const list = byHash.get(h) ?? [];
        list.push(f.path);
        byHash.set(h, list);
      }
    } catch { /* ignore */ }
  }

  for (const [, list] of byHash) {
    if (list.length > 1) {
      for (let i = 1; i < list.length; i++) {
        findings.push({ kind: "duplicate", file: list[i], detail: `Duplicate of ${list[0]}.`, bytes: 0, fixable: true });
      }
    }
  }

  const reclaimable = findings.filter((f) => f.fixable).reduce((a, f) => a + f.bytes, 0);
  return { findings, totalBytes: total, reclaimableBytes: reclaimable };
}
