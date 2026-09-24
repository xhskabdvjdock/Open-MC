"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, RotateCw, FlipHorizontal2, FlipVertical2, Save } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { loadImage, downloadBlob, clamp } from "@/lib/pixel-utils";
import { saveProject, uid } from "@/lib/storage";
import { Btn, inputCls, inputStyle } from "@/components/ui";

function ToolBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border p-2.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function OpButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="ui-transition flex w-fit items-center gap-1.5 rounded border px-2.5 py-1 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)" }}>
      {children}
    </button>
  );
}

export default function TexturesPage() {
  const { notify, setProject } = useApp();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [name, setName] = useState("texture");
  const [dirty, setDirty] = useState(false);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

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

  useEffect(() => {
    setProject(canvas ? { name: `${name}.png`, kind: "Texture", dirty } : null);
  }, [canvas, name, dirty, setProject]);
  useEffect(() => () => setProject(null), [setProject]);

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
      setDirty(true);
      notify("Image loaded");
    } catch { notify("Could not decode image.", "err"); }
  }, [notify]);

  const markDirty = useCallback(() => setDirty(true), []);

  const mutate = useCallback((fn: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => HTMLCanvasElement | void, label: string) => {
    if (!canvas) { notify("Load an image first.", "err"); return; }
    const out = fn(canvas.getContext("2d", { willReadFrequently: true })!, canvas);
    if (out && out !== canvas) setCanvas(out);
    else { setCanvas(canvas); rerender(); }
    markDirty();
    notify(label);
  }, [canvas, notify, markDirty]);

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
    setDirty(false);
    notify("Exported");
  };

  const save = async () => {
    if (!canvas) { notify("Nothing to save.", "err"); return; }
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/png"));
    if (!blob) return;
    await saveProject({ id: uid("tex"), kind: "other", name, updatedAt: Date.now(), data: blob });
    setDirty(false);
    notify("Saved to projects");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (typing) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "s") { e.preventDefault(); void save(); }
      if (e.key.toLowerCase() === "e") { e.preventDefault(); void exportPng(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const url = canvas?.toDataURL("image/png");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          aria-label="File name"
          spellCheck={false}
          className="w-40 rounded border border-transparent bg-transparent px-2 py-1 text-[14px] font-bold outline-none"
          onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border)")}
          onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "transparent")}
        />
        <span className="flex items-center gap-1.5 font-mono text-[11.5px]" style={{ color: "var(--muted)" }} role="status">
          <span className="inline-block size-2 rounded-full" style={{ background: dirty ? "var(--warn)" : "var(--accent)" }} />
          {dirty ? "Unsaved changes" : canvas ? "Ready" : "Empty"}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          <Btn onClick={save} title="Save to projects (Ctrl+S)">
            <Save className="size-4" aria-hidden /> Save
          </Btn>
          <Btn primary onClick={exportPng} title="Export PNG (Ctrl+E)">
            <Download className="size-4" aria-hidden /> Export PNG
          </Btn>
        </span>
      </div>

      <Dropzone accept="image/*" onFiles={onFiles} label="Drop an image to edit" hint="All processing is local · nearest-neighbor by default" compact />

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>
            Preview {canvas ? `${canvas.width}×${canvas.height}` : ""}
          </h2>
          {url && canvas ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Texture being edited" className="pixel max-h-[520px] w-auto max-w-full rounded-sm border" style={{ borderColor: "var(--border)" }} />
          ) : (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--muted)" }}>Drop an image above to begin.</p>
          )}
        </div>

        <div className="flex flex-col gap-2.5 text-[13px]" style={{ maxHeight: "min(78vh, 980px)", overflowY: "auto" }}>
          <ToolBox title="Resize">
            <div className="flex items-center gap-2">
              <label className="flex flex-col text-[12px]">W<input type="number" value={rw} onChange={(e) => setRw(+e.target.value)} className={inputCls} style={inputStyle()} /></label>
              <label className="flex flex-col text-[12px]">H<input type="number" value={rh} onChange={(e) => setRh(+e.target.value)} className={inputCls} style={inputStyle()} /></label>
            </div>
            <label className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={nearest} onChange={(e) => setNearest(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Nearest-neighbor</label>
            <OpButton onClick={doResize}>Apply resize</OpButton>
          </ToolBox>

          <ToolBox title="Crop">
            <div className="grid grid-cols-4 gap-1.5">
              {(["x", "y", "w", "h"] as const).map((k) => (
                <label key={k} className="flex flex-col text-[12px]">{k}
                  <input type="number" value={crop[k]} onChange={(e) => setCrop({ ...crop, [k]: +e.target.value })} className={inputCls} style={inputStyle()} />
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
              <OpButton onClick={() => doFlip(true)}><FlipHorizontal2 className="size-3.5" aria-hidden /> H</OpButton>
              <OpButton onClick={() => doFlip(false)}><FlipVertical2 className="size-3.5" aria-hidden /> V</OpButton>
            </div>
          </ToolBox>

          <ToolBox title="Pixelate">
            <label>Block size: <span className="font-mono font-bold">{pixelSize}</span>
              <input type="range" min={2} max={16} value={pixelSize} onChange={(e) => setPixelSize(+e.target.value)} className="w-full" style={{ accentColor: "var(--accent)" }} />
            </label>
            <OpButton onClick={doPixelate}>Apply</OpButton>
          </ToolBox>

          <ToolBox title="Color replace">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[12px]">From <input type="color" value={fromColor} onChange={(e) => setFromColor(e.target.value)} /></label>
              <label className="flex items-center gap-1 text-[12px]">To <input type="color" value={toColor} onChange={(e) => setToColor(e.target.value)} /></label>
            </div>
            <label className="text-[12.5px]">Tolerance: <span className="font-mono">{tolerance}</span>
              <input type="range" min={0} max={200} value={tolerance} onChange={(e) => setTolerance(+e.target.value)} className="w-full" style={{ accentColor: "var(--accent)" }} />
            </label>
            <OpButton onClick={doColorReplace}>Apply</OpButton>
          </ToolBox>

          <ToolBox title="Brightness / Contrast">
            <label className="text-[12.5px]">Brightness: <span className="font-mono">{bright}</span>
              <input type="range" min={-100} max={100} value={bright} onChange={(e) => setBright(+e.target.value)} className="w-full" style={{ accentColor: "var(--accent)" }} />
            </label>
            <label className="text-[12.5px]">Contrast: <span className="font-mono">{contrast}</span>
              <input type="range" min={-100} max={100} value={contrast} onChange={(e) => setContrast(+e.target.value)} className="w-full" style={{ accentColor: "var(--accent)" }} />
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
              <ul className="mt-1 flex flex-col gap-1">
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
