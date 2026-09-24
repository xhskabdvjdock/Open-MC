// Centralized Minecraft version definitions. Add new versions here only.
export interface McVersion {
  id: string;          // e.g. "1.21.4"
  label: string;       // e.g. "1.21.x"
  packFormat: number;  // resource pack pack_format
  dataPackFormat?: number;
  minPackFormat?: number;
  maxPackFormat?: number;
  notes: string;
}

export const MC_VERSIONS: McVersion[] = [
  { id: "1.21.4", label: "1.21.x", packFormat: 48, notes: "Current line. Tricky Trials / Bundles era." },
  { id: "1.20.6", label: "1.20.x", packFormat: 32, notes: "Trails & Tales." },
  { id: "1.19.4", label: "1.19.x", packFormat: 13, notes: "The Wild Update line." },
  { id: "1.18.2", label: "1.18.x", packFormat: 8, notes: "Caves & Cliffs II." },
  { id: "1.17.1", label: "1.17.x", packFormat: 7, notes: "Caves & Cliffs I." },
  { id: "1.16.5", label: "1.16.x", packFormat: 6, notes: "Nether Update." },
];

export const PACK_FORMAT_TO_VERSION: Record<number, string> = {};
for (const v of MC_VERSIONS) PACK_FORMAT_TO_VERSION[v.packFormat] = v.id;

export function packFormatForVersion(versionId: string): number {
  return MC_VERSIONS.find((v) => v.id === versionId)?.packFormat ?? 48;
}

export function versionForPackFormat(fmt: number): McVersion | undefined {
  return MC_VERSIONS.find((v) => v.packFormat === fmt);
}

// Known folder structure rules used by validator/optimizer/explorer
export const KNOWN_ROOT_FILES = ["pack.mcmeta", "pack.png"];
export const KNOWN_ASSET_DIRS = ["textures", "models", "sounds", "font", "lang", "shaders", "particles", "atlases"];
export const TEXTURE_DIRS = ["block", "item", "entity", "gui", "colormap", "effect", "environment", "map", "misc", "mob_effect", "models", "painting", "particle"];
export const MAX_PACK_BYTES = 500 * 1024 * 1024; // 500MB extraction cap
export const MAX_PACK_FILES = 8000;
