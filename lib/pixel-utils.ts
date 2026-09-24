export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export async function bytesToDataUrl(bytes: Uint8Array, mime = "image/png"): Promise<string> {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  return await blobToDataUrl(blob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not decode image. Supported: PNG, JPEG, GIF, WebP."));
      img.src = url;
    });
    return img;
  } finally {
    if (typeof src !== "string") setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

export function hexToRgba(hex: string): [number, number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 6) h += "ff";
  const n = parseInt(h, 16);
  return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbaToHex(r: number, g: number, b: number, a = 255): string {
  const p = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}${a === 255 ? "" : p(a)}`;
}

// Minecraft text palette (approx vanilla map/chat colors)
export const MC_PALETTE = [
  "#000000", "#ffffff", "#b3b3b3", "#555555",
  "#ff5555", "#aa0000", "#ffaa00", "#ff55ff",
  "#55ffff", "#55ff55", "#00aa00", "#5555ff",
  "#0000aa", "#aa00aa", "#00aaaa", "#ffff55",
  "#8b5a2b", "#5d8a3c", "#7a7a7a", "#3b3b3b",
  "#d8c08a", "#6b4a2f", "#4a6b8a", "#2d2d2d",
];

export const SKIN_REGIONS_64x64 = {
  head: { x: 8, y: 8, w: 8, h: 8 },
  headOverlay: { x: 40, y: 8, w: 8, h: 8 },
  body: { x: 20, y: 20, w: 8, h: 12 },
  bodyOverlay: { x: 20, y: 36, w: 8, h: 12 },
  armR: { x: 44, y: 20, w: 4, h: 12 },
  armROverlay: { x: 44, y: 36, w: 4, h: 12 },
  armL: { x: 36, y: 52, w: 4, h: 12 },
  armLOverlay: { x: 52, y: 52, w: 4, h: 12 },
  legR: { x: 4, y: 20, w: 4, h: 12 },
  legROverlay: { x: 4, y: 36, w: 4, h: 12 },
  legL: { x: 20, y: 52, w: 4, h: 12 },
  legLOverlay: { x: 4, y: 52, w: 4, h: 12 },
};

export function isValidSkinSize(w: number, h: number): boolean {
  return (w === 64 && h === 64) || (w === 64 && h === 32) || (w === 128 && h === 128) || (w === 128 && h === 64);
}
