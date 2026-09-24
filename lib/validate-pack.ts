import { versionForPackFormat } from "./versions";

export interface PackIssue {
  level: "error" | "warning" | "info";
  file: string;
  message: string;
  line?: number;
}

export interface FileLike {
  path: string;
  size: number;
  bytes?: () => Promise<Uint8Array>;
  text?: () => Promise<string>;
}

export interface ValidationReport {
  ok: boolean;
  errors: PackIssue[];
  warnings: PackIssue[];
  infos: PackIssue[];
  checkedFiles: number;
  versionId: string;
}

function tryParseJson(text: string): { ok: boolean; data?: unknown; error?: string; line?: number } {
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON";
    const m = /line (\d+)/i.exec(msg) ?? /position (\d+)/i.exec(msg);
    return { ok: false, error: msg, line: m ? parseInt(m[1], 10) : undefined };
  }
}

export async function validatePack(files: FileLike[], versionId: string): Promise<ValidationReport> {
  const errors: PackIssue[] = [];
  const warnings: PackIssue[] = [];
  const infos: PackIssue[] = [];
  const byPath = new Map(files.map((f) => [f.path, f]));

  // 1. pack.mcmeta
  const mcmeta = byPath.get("pack.mcmeta");
  if (!mcmeta) {
    errors.push({ level: "error", file: "pack.mcmeta", message: "Missing pack.mcmeta at archive root. A resource pack must contain it." });
  } else {
    try {
      const text = await mcmeta.text!();
      const parsed = tryParseJson(text);
      if (!parsed.ok) {
        errors.push({ level: "error", file: "pack.mcmeta", message: `Invalid JSON: ${parsed.error}`, line: parsed.line });
      } else {
        const d = parsed.data as { pack?: { pack_format?: unknown; description?: unknown } };
        if (!d || typeof d !== "object" || !d.pack) {
          errors.push({ level: "error", file: "pack.mcmeta", message: 'Missing required "pack" object.' });
        } else {
          if (typeof d.pack.pack_format !== "number") {
            errors.push({ level: "error", file: "pack.mcmeta", message: '"pack.pack_format" must be a number.' });
          } else {
            const known = versionForPackFormat(d.pack.pack_format);
            if (!known) warnings.push({ level: "warning", file: "pack.mcmeta", message: `Unknown pack_format ${d.pack.pack_format} for selected version ${versionId}. Export may not load in-game.` });
            else infos.push({ level: "info", file: "pack.mcmeta", message: `pack_format ${d.pack.pack_format} → ${known.id}.` });
          }
          if (typeof d.pack.description !== "string") {
            warnings.push({ level: "warning", file: "pack.mcmeta", message: '"pack.description" should be a string.' });
          }
        }
      }
    } catch {
      errors.push({ level: "error", file: "pack.mcmeta", message: "Could not read pack.mcmeta." });
    }
  }

  // 2. pack.png
  if (!byPath.get("pack.png")) {
    warnings.push({ level: "warning", file: "pack.png", message: "Missing pack.png icon. The pack will show a default icon." });
  } else {
    const f = byPath.get("pack.png")!;
    if (f.size > 2 * 1024 * 1024) warnings.push({ level: "warning", file: "pack.png", message: "pack.png is larger than 2 MB. Consider resizing to 128×128." });
    try {
      const b = await f.bytes!();
      const isPng = b.length > 4 && b[0] === 0x89 && b[1] === 0x50;
      if (!isPng) errors.push({ level: "error", file: "pack.png", message: "pack.png is not a valid PNG file." });
    } catch { /* ignore */ }
  }

  // 3. folder structure
  const hasAssets = files.some((f) => f.path === "assets/" || f.path.startsWith("assets/"));
  if (!hasAssets) errors.push({ level: "error", file: "assets/", message: "Missing assets/ directory. Textures, models and sounds live under assets/<namespace>/." });

  // 4. per-file checks
  const seen = new Set<string>();
  let jsonChecked = 0;
  for (const f of files) {
    if (f.path.endsWith("/")) continue;
    if (seen.has(f.path)) errors.push({ level: "error", file: f.path, message: "Duplicate path in archive." });
    seen.add(f.path);
    if (f.path.includes(" ")) infos.push({ level: "info", file: f.path, message: "Path contains spaces. Minecraft accepts it, but underscores are safer." });
    if (f.path !== f.path.toLowerCase() && f.path.startsWith("assets/")) {
      warnings.push({ level: "warning", file: f.path, message: "Uppercase letters in assets path. Minecraft resource locations are lowercase by convention." });
    }
    if (f.path.endsWith(".json")) {
      jsonChecked++;
      try {
        const text = await f.text!();
        const parsed = tryParseJson(text);
        if (!parsed.ok) errors.push({ level: "error", file: f.path, message: `Invalid JSON: ${parsed.error}`, line: parsed.line });
        else if (f.path.includes("/models/")) {
          const d = parsed.data as Record<string, unknown>;
          if (!d || typeof d !== "object" || (!("parent" in d) && !("elements" in d) && !("textures" in d))) {
            warnings.push({ level: "warning", file: f.path, message: "Model JSON has none of parent/elements/textures. It may not render." });
          }
        }
      } catch {
        warnings.push({ level: "warning", file: f.path, message: "Could not read file for validation." });
      }
    }
    if (f.path.endsWith(".png") && f.size > 4 * 1024 * 1024) {
      warnings.push({ level: "warning", file: f.path, message: `Large texture (${(f.size / 1048576).toFixed(1)} MB). Consider downsizing.` });
    }
    if (/\.(exe|bat|cmd|ps1|sh|dll|so)$/i.test(f.path)) {
      errors.push({ level: "error", file: f.path, message: "Executable file inside resource pack. Remove before sharing." });
    }
  }

  // 5. unused-file heuristic: sounds.json references
  const soundsJson = byPath.get("assets/minecraft/sounds.json");
  if (soundsJson) {
    try {
      const text = await soundsJson.text!();
      const parsed = tryParseJson(text);
      if (parsed.ok) infos.push({ level: "info", file: "assets/minecraft/sounds.json", message: "sounds.json parsed successfully." });
    } catch { /* handled above */ }
  }

  if (jsonChecked === 0 && files.length > 5) {
    infos.push({ level: "info", file: "(pack)", message: "No JSON files found. Pure-texture packs are valid." });
  }

  return { ok: errors.length === 0, errors, warnings, infos, checkedFiles: files.length, versionId };
}
