"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid3x3, Download, ImagePlus } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { PixelEditor, type PixelEditorHandle } from "@/components/PixelEditor";
import { loadImage, downloadBlob, MC_PALETTE, clamp } from "@/lib/pixel-utils";
import { kvGet, kvSet } from "@/lib/storage";
import { saveProject, uid } from "@/lib/storage";

interface CustomPalette { name: string; colors: string[] }

export default function PixelArtPage() {
  const { notify } = useApp();
  // Canvas dims + optional overlay image (conversion result). PixelEditor starts
  // blank when overlay is null, so no mount effect is needed for init.
  const [dims, setDims] = useState<[number, number]>([32, 32]);
  const [overlay, setOverlay] = useState<HTMLCanvasElement | null>(null);
  const [editKey, setEditKey] = useState(0);
  const ref = useRef<PixelEditorHandle>(null);

  const changeSize = useCallback((s: number) => {
    setDims([s, s]);
    setOverlay(null);
    setEditKey((k) => k + 1);
  }, []);

  // converter state
  const [srcImg, setSrcImg] = useState<HTMLImageElement | null>(null);
  const [res, setRes] = useState(48);
  const [colorCount, setColorCount] = useState(16);
  const [paletteName, setPaletteName] = useState("minecraft");
  const [dither, setDither] = useState(false);
  const [bright, setBright] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [palettes, setPalettes] = useState<CustomPalette[]>([]);
  const [newPalName, setNewPalName] = useState("");

  useEffect(() => {
    let live = true;
    kvGet<CustomPalette[]>("palettes", []).then((p) => { if (live) setPalettes(p); });
    return () => { live = false; };
  }, []);

  const activePalette: string[] = useMemo(() => {
    if (paletteName === "minecraft") return MC_PALETTE;
    if (paletteName === "grayscale") return ["#000000", "#333333", "#666666", "#999999", "#cccccc", "#ffffff"];
    return palettes.find((p) => p.name === paletteName)?.colors ?? MC_PALETTE;
  }, [paletteName, palettes]);

  const onSource = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    try {
      setSrcImg(await loadImage(f));
      notify("Image loaded — adjust settings, then Convert");
    } catch { notify("Could not decode image.", "err"); }
  }, [notify]);

  const nearest = (r: number, g: number, b: number, pal: string[]): [number, number, number] => {
    let best = pal[0], bd = Infinity;
    for (const hex of pal) {
      const pr = parseInt(hex.slice(1, 3), 16), pg = parseInt(hex.slice(3, 5), 16), pb = parseInt(hex.slice(5, 7), 16);
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < bd) { bd = d; best = hex; }
    }
    return [parseInt(best.slice(1, 3), 16), parseInt(best.slice(3, 5), 16), parseInt(best.slice(5, 7), 16)];
  };

  const convert = useCallback(() => {
    if (!srcImg) { notify("Load a source image first.", "err"); return; }
    const w = res, h = Math.max(1, Math.round(res * (srcImg.naturalHeight / srcImg.naturalWidth)));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(srcImg, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    // brightness/contrast
    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < d.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        let v = d[i + k];
        v = cf * (v - 128) + 128 + bright;
        d[i + k] = clamp(Math.round(v), 0, 255);
      }
    }
    // quantize to palette (limit count by slicing active palette honestly labeled custom)
    const pal = activePalette.slice(0, Math.max(2, Math.min(64, colorCount)));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const oldR = d[i], oldG = d[i + 1], oldB = d[i + 2];
        const [nr, ng, nb] = nearest(oldR, oldG, oldB, pal);
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
        if (dither) {
          const er = oldR - nr, eg = oldG - ng, eb = oldB - nb;
          const spread = (dx: number, dy: number, f: number) => {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
            const j = (ny * w + nx) * 4;
            d[j] = clamp(d[j] + er * f, 0, 255);
            d[j + 1] = clamp(d[j + 1] + eg * f, 0, 255);
            d[j + 2] = clamp(d[j + 2] + eb * f, 0, 255);
          };
          spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    setPreviewUrl(c.toDataURL("image/png"));
  }, [srcImg, res, colorCount, activePalette, dither, bright, contrast, notify]);

  const useAsCanvas = useCallback(async () => {
    if (!previewUrl) return;
    const img = await loadImage(previewUrl);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    setOverlay(c);
    setDims([img.naturalWidth, img.naturalHeight]);
    setEditKey((k) => k + 1);
    notify("Loaded into editor");
  }, [previewUrl, notify]);

  const exportArt = useCallback(async () => {
    const blob = await ref.current?.getBlob();
    if (!blob) { notify("Nothing to export.", "err"); return; }
    downloadBlob(blob, `pixel-art-${dims[0]}x${dims[1]}.png`);
    await saveProject({ id: uid("art"), kind: "pixel-art", name: `pixel-art-${dims[0]}`, updatedAt: Date.now(), data: blob });
    notify("Exported");
  }, [notify, dims]);

  const savePalette = useCallback(async () => {
    const c = ref.current?.getCanvas();
    const colors = new Set<string>();
    if (c) {
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        colors.add("#" + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
        if (colors.size >= 32) break;
      }
    }
    const name = newPalName.trim() || `palette-${palettes.length + 1}`;
    const next = [...palettes, { name, colors: [...colors].slice(0, 32) }];
    setPalettes(next);
    await kvSet("palettes", next);
    setNewPalName("");
    notify(`Palette "${name}" saved (${colors.size} colors)`);
  }, [notify, newPalName, palettes]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><Grid3x3 className="size-5 text-emerald-600" aria-hidden /> Pixel Art Studio</h1>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold">Canvas:</span>
        {[8, 16, 32, 48, 64].map((s) => (
          <button key={s} onClick={() => changeSize(s)} aria-pressed={dims[0] === s && dims[1] === s} className={`rounded border px-2.5 py-1 font-mono text-[12.5px] ${dims[0] === s && dims[1] === s ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 hover:border-emerald-500 dark:border-slate-700"}`}>
            {s}×{s}
          </button>
        ))}
        <button onClick={exportArt} className="ms-auto flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
          <Download className="size-4" aria-hidden /> Export PNG
        </button>
      </div>

      <PixelEditor key={`${dims[0]}x${dims[1]}:${editKey}`} ref={ref} width={dims[0]} height={dims[1]} initialImage={overlay} />

      <section aria-label="Image to pixel art" className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold"><ImagePlus className="size-4" aria-hidden /> Image → Pixel Art (local)</h2>
        <Dropzone accept="image/*" onFiles={onSource} label="Drop a source image" hint="Processed locally — nothing uploaded" compact />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-2 text-[13px]">
            <label>Resolution (width px): <span className="font-mono font-bold">{res}</span>
              <input type="range" min={8} max={128} value={res} onChange={(e) => setRes(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <label>Color count: <span className="font-mono font-bold">{colorCount}</span>
              <input type="range" min={2} max={32} value={colorCount} onChange={(e) => setColorCount(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <label>Palette:
              <select value={paletteName} onChange={(e) => setPaletteName(e.target.value)} className="ms-2 rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
                <option value="minecraft">Minecraft-ish (custom set, not official)</option>
                <option value="grayscale">Grayscale</option>
                {palettes.map((p) => <option key={p.name} value={p.name}>{p.name} (custom)</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-1.5" aria-label="Active palette swatches">
              {activePalette.slice(0, colorCount).map((c) => (
                <span key={c} title={c} className="size-5 rounded-sm border border-black/20" style={{ background: c }} />
              ))}
            </div>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} className="accent-emerald-600" /> Floyd–Steinberg dithering</label>
            <label>Brightness: <span className="font-mono">{bright}</span>
              <input type="range" min={-80} max={80} value={bright} onChange={(e) => setBright(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <label>Contrast: <span className="font-mono">{contrast}</span>
              <input type="range" min={-100} max={100} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <div className="flex gap-2">
              <button onClick={convert} className="rounded-md bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">Convert</button>
              {previewUrl && <button onClick={useAsCanvas} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold hover:border-emerald-500 dark:border-slate-700">Edit result</button>}
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-[13px] font-bold">Result preview</h3>
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Pixel art conversion preview" className="max-h-72 w-auto rounded border border-slate-200 dark:border-slate-700" style={{ imageRendering: "pixelated" }} />
            ) : (
              <p className="text-[12.5px] text-slate-500">No conversion yet. Load an image and press Convert.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Palettes" className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-2 text-[14px] font-bold">Palettes</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={newPalName} onChange={(e) => setNewPalName(e.target.value)} placeholder="New palette name" aria-label="New palette name" className="rounded border border-slate-200 px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-950" />
          <button onClick={savePalette} className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700">Extract from canvas + save</button>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {palettes.map((p) => (
            <li key={p.name} className="flex items-center gap-2 text-[13px]">
              <span className="font-mono font-bold">{p.name}</span>
              <span className="flex gap-1">{p.colors.map((c) => <span key={c} title={c} className="size-4 rounded-sm border border-black/20" style={{ background: c }} />)}</span>
              <button
                onClick={async () => {
                  const next = palettes.filter((x) => x.name !== p.name);
                  setPalettes(next);
                  await kvSet("palettes", next);
                  notify("Palette deleted");
                }}
                className="ms-auto text-[12px] text-red-600 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
          {palettes.length === 0 && <li className="text-[12.5px] text-slate-500">No custom palettes yet.</li>}
        </ul>
      </section>
    </div>
  );
}
