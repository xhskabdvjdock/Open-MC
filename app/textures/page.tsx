"use client";
import { useCallback, useState } from "react";
import { Image as ImageIcon, Download, RotateCw, FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { loadImage, downloadBlob, clamp } from "@/lib/pixel-utils";
import { saveProject, uid } from "@/lib/storage";

export default function TexturesPage() {
  const { notify } = useApp();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [name, setName] = useState("texture");
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  // op params
  const [rw, setRw] = useState(16);
  const [rh, setRh] = useState(16);
  const [nearest, setNearest] = useState(true);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 16, h: 16 });
  const [fromColor, setFromColor] = useState("#ff00ff");
  const [toColor, setToColor] = useState("#00ff00");
  const [tolerance, setTolerance] = useState(32);
  const [bright, setBright] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [pixelSize, setPixelSize] = useState(4);

  const onFiles = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    try {
      const img = await loadImage(f);
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      setCanvas(c);
      setName(f.name.replace(/\.[a-z]+$/i, ""));
      setRw(c.width); setRh(c.height);
      setCrop({ x: 0, y: 0, w: c.width, h: c.height });
      notify("Image loaded");
    } catch { notify("Could not decode image.", "err"); }
  }, [notify]);

  const mutate = useCallback((fn: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => HTMLCanvasElement | void, label: string) => {
    if (!canvas) { notify("Load an image first.", "err"); return; }
    const out = fn(canvas.getContext("2d", { willReadFrequently: true })!, canvas);
    if (out && out !== canvas) setCanvas(out);
    else { setCanvas(canvas); rerender(); }
    notify(label);
  }, [canvas, notify]);

  const doResize = () => mutate((_, c) => {
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.min(2048, rw));
    out.height = Math.max(1, Math.min(2048, rh));
    const octx = out.getContext("2d")!;
    octx.imageSmoothingEnabled = !nearest;
    octx.drawImage(c, 0, 0, out.width, out.height);
    return out;
  }, `Resized to ${rw}×${rh}`);

  const doCrop = () => mutate((_, c) => {
    const x = clamp(crop.x, 0, c.width - 1), y = clamp(crop.y, 0, c.height - 1);
    const w = clamp(crop.w, 1, c.width - x), h = clamp(crop.h, 1, c.height - y);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    out.getContext("2d")!.drawImage(c, x, y, w, h, 0, 0, w, h);
    return out;
  }, "Cropped");

  const doRotate = (deg: 90 | 180 | 270) => mutate((_, c) => {
    const out = document.createElement("canvas");
    out.width = deg === 180 ? c.width : c.height;
    out.height = deg === 180 ? c.height : c.width;
    const o = out.getContext("2d")!;
    o.imageSmoothingEnabled = false;
    o.translate(out.width / 2, out.height / 2);
    o.rotate((deg * Math.PI) / 180);
    o.drawImage(c, -c.width / 2, -c.height / 2);
    return out;
  }, `Rotated ${deg}°`);

  const doFlip = (h: boolean) => mutate((_, c) => {
    const out = document.createElement("canvas");
    out.width = c.width; out.height = c.height;
    const o = out.getContext("2d")!;
    o.imageSmoothingEnabled = false;
    o.translate(h ? c.width : 0, h ? 0 : c.height);
    o.scale(h ? -1 : 1, h ? 1 : -1);
    o.drawImage(c, 0, 0);
    return out;
  }, h ? "Flipped horizontally" : "Flipped vertically");

  const doPixelate = () => mutate((_, c) => {
    const out = document.createElement("canvas");
    out.width = c.width; out.height = c.height;
    const o = out.getContext("2d")!;
    const sw = Math.max(1, Math.floor(c.width / pixelSize)), sh = Math.max(1, Math.floor(c.height / pixelSize));
    const tmp = document.createElement("canvas");
    tmp.width = sw; tmp.height = sh;
    const tctx = tmp.getContext("2d")!;
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(c, 0, 0, sw, sh);
    o.imageSmoothingEnabled = false;
    o.drawImage(tmp, 0, 0, out.width, out.height);
    return out;
  }, `Pixelated ÷${pixelSize}`);

  const hexRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

  const doColorReplace = () => mutate((ctx, c) => {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const [fr, fg, fb] = hexRgb(fromColor);
    const [tr, tg, tb] = hexRgb(toColor);
    for (let i = 0; i < img.data.length; i += 4) {
      const dd = Math.sqrt((img.data[i] - fr) ** 2 + (img.data[i + 1] - fg) ** 2 + (img.data[i + 2] - fb) ** 2);
      if (dd <= tolerance && img.data[i + 3] > 0) {
        img.data[i] = tr; img.data[i + 1] = tg; img.data[i + 2] = tb;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, "Colors replaced");

  const doBrightContrast = () => mutate((ctx, c) => {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < img.data.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        img.data[i + k] = clamp(Math.round(cf * (img.data[i + k] - 128) + 128 + bright), 0, 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, "Brightness/contrast applied");

  const doTransparency = (mode: "white" | "black") => mutate((ctx, c) => {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const lum = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
      if (mode === "white" && lum > 240) img.data[i + 3] = 0;
      if (mode === "black" && lum < 12) img.data[i + 3] = 0;
    }
    ctx.putImageData(img, 0, 0);
  }, mode === "white" ? "White made transparent" : "Black made transparent");

  const [palette, setPalette] = useState<{ hex: string; pct: number }[]>([]);
  const extractPalette = () => {
    if (!canvas) { notify("Load an image first.", "err"); return; }
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = new Map<string, number>();
    let total = 0;
    for (let i = 0; i < d.length; i += 16) {
      if (d[i + 3] < 128) continue;
      // quantize to 4-bit per channel for grouping
      const key = [d[i] >> 4, d[i + 1] >> 4, d[i + 2] >> 4].join(",");
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => {
      const [r, g, b] = k.split(",").map((x) => (parseInt(x, 10) << 4) | 8);
      return { hex: "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""), pct: total ? (n / total) * 100 : 0 };
    });
    setPalette(top);
    notify(`Extracted ${top.length} colors`);
  };

  const exportPng = async () => {
    if (!canvas) { notify("Nothing to export.", "err"); return; }
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
    if (!blob) { notify("Export failed", "err"); return; }
    downloadBlob(blob, `${name || "texture"}.png`);
    await saveProject({ id: uid("tex"), kind: "other", name, updatedAt: Date.now(), data: blob });
    notify("Exported");
  };

  const url = canvas?.toDataURL("image/png");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><ImageIcon className="size-5 text-emerald-600" aria-hidden /> Texture Tools</h1>
        <span className="ms-auto flex items-center gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="File name" className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
          <button onClick={exportPng} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
            <Download className="size-4" aria-hidden /> Export PNG
          </button>
        </span>
      </div>
      <Dropzone accept="image/*" onFiles={onFiles} label="Drop an image to edit" hint="All processing is local · pixel operations use nearest-neighbor by default" compact />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-2 text-[13px] font-bold">Preview ({canvas ? `${canvas.width}×${canvas.height}` : "empty"})</h2>
          {url && canvas ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Texture being edited" className="max-h-[480px] w-auto max-w-full rounded border border-slate-200 bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:16px_16px] dark:border-slate-700" style={{ imageRendering: "pixelated" }} />
          ) : (
            <p className="text-[13px] text-slate-500">Load an image to begin.</p>
          )}
        </div>
        <div className="flex flex-col gap-3 text-[13px]">
          <ToolBox title="Resize">
            <div className="flex items-center gap-2">
              <label>W <input type="number" value={rw} onChange={(e) => setRw(+e.target.value)} className="w-20 rounded border border-slate-200 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-950" /></label>
              <label>H <input type="number" value={rh} onChange={(e) => setRh(+e.target.value)} className="w-20 rounded border border-slate-200 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-950" /></label>
            </div>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={nearest} onChange={(e) => setNearest(e.target.checked)} className="accent-emerald-600" /> Nearest-neighbor (pixel-perfect)</label>
            <OpButton onClick={doResize}>Apply resize</OpButton>
          </ToolBox>
          <ToolBox title="Crop">
            <div className="grid grid-cols-4 gap-1.5">
              {(["x", "y", "w", "h"] as const).map((k) => (
                <label key={k} className="flex flex-col">{k}
                  <input type="number" value={crop[k]} onChange={(e) => setCrop({ ...crop, [k]: +e.target.value })} className="rounded border border-slate-200 px-1.5 py-1 dark:border-slate-700 dark:bg-slate-950" />
                </label>
              ))}
            </div>
            <OpButton onClick={doCrop}>Apply crop</OpButton>
          </ToolBox>
          <ToolBox title="Rotate / Flip">
            <div className="flex flex-wrap gap-1.5">
              <OpButton onClick={() => doRotate(90)}><RotateCw className="size-3.5" aria-hidden /> 90°</OpButton>
              <OpButton onClick={() => doRotate(180)}>180°</OpButton>
              <OpButton onClick={() => doRotate(270)}>270°</OpButton>
              <OpButton onClick={() => doFlip(true)}><FlipHorizontal2 className="size-3.5" aria-hidden /> Flip H</OpButton>
              <OpButton onClick={() => doFlip(false)}><FlipVertical2 className="size-3.5" aria-hidden /> Flip V</OpButton>
            </div>
          </ToolBox>
          <ToolBox title="Pixelate">
            <label>Block size: <span className="font-mono font-bold">{pixelSize}</span>
              <input type="range" min={2} max={16} value={pixelSize} onChange={(e) => setPixelSize(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <OpButton onClick={doPixelate}>Apply pixelate</OpButton>
          </ToolBox>
          <ToolBox title="Color replace">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">From <input type="color" value={fromColor} onChange={(e) => setFromColor(e.target.value)} /></label>
              <label className="flex items-center gap-1">To <input type="color" value={toColor} onChange={(e) => setToColor(e.target.value)} /></label>
            </div>
            <label>Tolerance: <span className="font-mono">{tolerance}</span>
              <input type="range" min={0} max={200} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <OpButton onClick={doColorReplace}>Apply replace</OpButton>
          </ToolBox>
          <ToolBox title="Brightness / Contrast">
            <label>Brightness: <span className="font-mono">{bright}</span>
              <input type="range" min={-100} max={100} value={bright} onChange={(e) => setBright(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <label>Contrast: <span className="font-mono">{contrast}</span>
              <input type="range" min={-100} max={100} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="w-full accent-emerald-600" />
            </label>
            <OpButton onClick={doBrightContrast}>Apply</OpButton>
          </ToolBox>
          <ToolBox title="Transparency">
            <div className="flex gap-1.5">
              <OpButton onClick={() => doTransparency("white")}>White → transparent</OpButton>
              <OpButton onClick={() => doTransparency("black")}>Black → transparent</OpButton>
            </div>
          </ToolBox>
          <ToolBox title="Palette extractor">
            <OpButton onClick={extractPalette}>Extract top colors</OpButton>
            {palette.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-1">
                {palette.map((p) => (
                  <li key={p.hex} className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="size-4 rounded-sm border border-black/20" style={{ background: p.hex }} />
                    {p.hex} · {p.pct.toFixed(1)}%
                  </li>
                ))}
              </ul>
            )}
          </ToolBox>
        </div>
      </div>
    </div>
  );
}

function ToolBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function OpButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-fit items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-[12.5px] font-semibold hover:border-emerald-500 dark:border-slate-700">
      {children}
    </button>
  );
}
