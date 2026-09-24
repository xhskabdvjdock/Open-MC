"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Save } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { PixelEditor, type PixelEditorHandle } from "@/components/PixelEditor";
import { loadImage, downloadBlob, MC_PALETTE, clamp } from "@/lib/pixel-utils";
import { kvGet, kvSet } from "@/lib/storage";
import { saveProject, uid } from "@/lib/storage";
import { Btn, Tabs, StatusBar } from "@/components/ui";

interface CustomPalette { name: string; colors: string[] }

export default function PixelArtPage() {
  const { notify, showGrid, setProject } = useApp();
  // Canvas dims + optional overlay image (conversion result). PixelEditor starts
  // blank when overlay is null, so no mount effect is needed for init.
  const [dims, setDims] = useState<[number, number]>([32, 32]);
  const [overlay, setOverlay] = useState<HTMLCanvasElement | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(8);
  const [sideTab, setSideTab] = useState<"convert" | "palettes">("convert");
  const ref = useRef<PixelEditorHandle>(null);

  const changeSize = useCallback((s: number) => {
    setDims([s, s]);
    setOverlay(null);
    setEditKey((k) => k + 1);
    setDirty(true);
  }, []);

  useEffect(() => {
    setProject({ name: `pixel-art-${dims[0]}`, kind: "Pixel Art", dirty });
  }, [dims, dirty, setProject]);
  useEffect(() => () => setProject(null), [setProject]);

  // converter state
  const [srcImg, setSrcImg] = useState<HTMLImageElement | null>(null);
  const [res, setRes] = useState(48);
  const [limitPalette, setLimitPalette] = useState(true);
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
    if (limitPalette) {
      // true palette — nearest color per pixel, honest quantization
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
    }
    // if limitPalette is off we keep true original colors (only resize + brightness/contrast)
    ctx.putImageData(img, 0, 0);
    setPreviewUrl(c.toDataURL("image/png"));
  }, [srcImg, res, limitPalette, colorCount, activePalette, dither, bright, contrast, notify]);

  const useAsCanvas = useCallback(async () => {
    if (!previewUrl) return;
    const img = await loadImage(previewUrl);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    setOverlay(c);
    setDims([img.naturalWidth, img.naturalHeight]);
    setEditKey((k) => k + 1);
    setDirty(true);
    notify("Loaded into editor");
  }, [previewUrl, notify]);

  const persist = useCallback(async () => {
    const blob = await ref.current?.getBlob();
    if (!blob) { notify("Nothing to save.", "err"); return; }
    await saveProject({ id: uid("art"), kind: "pixel-art", name: `pixel-art-${dims[0]}`, updatedAt: Date.now(), data: blob });
    setDirty(false);
    notify("Saved to projects");
  }, [notify, dims]);

  const exportArt = useCallback(async () => {
    const blob = await ref.current?.getBlob();
    if (!blob) { notify("Nothing to export.", "err"); return; }
    downloadBlob(blob, `pixel-art-${dims[0]}x${dims[1]}.png`);
    await saveProject({ id: uid("art"), kind: "pixel-art", name: `pixel-art-${dims[0]}`, updatedAt: Date.now(), data: blob });
    setDirty(false);
    notify("Exported");
  }, [notify, dims]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!(e.ctrlKey || e.metaKey) || typing) return;
      if (e.key.toLowerCase() === "s") { e.preventDefault(); void persist(); }
      if (e.key.toLowerCase() === "e") { e.preventDefault(); void exportArt(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist, exportArt]);

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

  const rangeCls = "w-full";
  const rangeStyle = { accentColor: "var(--accent)" } as React.CSSProperties;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1" role="group" aria-label="Canvas size">
          {[8, 16, 32, 48, 64].map((s) => (
            <button
              key={s}
              onClick={() => changeSize(s)}
              aria-pressed={dims[0] === s && dims[1] === s}
              className="ui-transition rounded border px-2 py-1 font-mono text-[12px]"
              style={{
                borderColor: dims[0] === s && dims[1] === s ? "var(--accent)" : "var(--border)",
                background: dims[0] === s && dims[1] === s ? "var(--accent)" : "transparent",
                color: dims[0] === s && dims[1] === s ? "#fff" : "var(--muted)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>{dims[0]}×{dims[1]}</span>
        <span className="ms-auto flex items-center gap-1.5">
          <Btn onClick={persist} title="Save to projects (Ctrl+S)">
            <Save className="size-4" aria-hidden /> Save
          </Btn>
          <Btn primary onClick={exportArt} title="Export PNG (Ctrl+E)">
            <Download className="size-4" aria-hidden /> Export
          </Btn>
        </span>
      </div>

      <div className="flex min-h-[480px] flex-1 flex-col gap-0 lg:flex-row" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
        {/* canvas dominates */}
        <div className="min-w-0 flex-1 p-3" style={{ background: "var(--bg)" }}>
          <PixelEditor
            key={`${dims[0]}x${dims[1]}:${editKey}`}
            ref={ref}
            width={dims[0]}
            height={dims[1]}
            initialImage={overlay}
            showGridDefault={showGrid}
            onEdit={() => setDirty(true)}
            onZoomChange={setZoom}
          />
        </div>
        {/* side panel */}
        <aside className="flex min-h-0 flex-col border-t lg:w-[300px] lg:flex-none lg:border-s lg:border-t-0" style={{ borderColor: "var(--border)", background: "var(--panel)" }} aria-label="Converter and palettes">
          <div className="px-3 pt-2">
            <Tabs
              ariaLabel="Side panel"
              active={sideTab}
              onChange={setSideTab}
              tabs={[
                { id: "convert", label: "Convert" },
                { id: "palettes", label: `Palettes${palettes.length ? ` (${palettes.length})` : ""}` },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {sideTab === "convert" ? (
              <div className="flex flex-col gap-2.5 text-[13px]">
                <Dropzone accept="image/*" onFiles={onSource} label="Drop a source image" hint="Processed locally — nothing uploaded" compact />
                <label>Resolution: <span className="font-mono font-bold">{res}px</span>
                  <input type="range" min={8} max={128} value={res} onChange={(e) => setRes(+e.target.value)} className={rangeCls} style={rangeStyle} />
                </label>
                <label className="flex items-center gap-1.5 font-semibold">
                  <input type="checkbox" checked={limitPalette} onChange={(e) => setLimitPalette(e.target.checked)} style={rangeStyle} /> Limit to palette (false = true original colors)
                </label>
                <label className={limitPalette ? "" : "opacity-40"}>Colors: <span className="font-mono font-bold">{colorCount}</span>
                  <input type="range" min={2} max={32} value={colorCount} onChange={(e) => setColorCount(+e.target.value)} className={rangeCls} style={rangeStyle} disabled={!limitPalette} />
                </label>
                <label className={limitPalette ? "" : "opacity-40"}>Palette:
                  <select value={paletteName} onChange={(e) => setPaletteName(e.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }} disabled={!limitPalette}>
                    <option value="minecraft">Minecraft-ish (custom, not official)</option>
                    <option value="grayscale">Grayscale</option>
                    {palettes.map((p) => <option key={p.name} value={p.name}>{p.name} (custom)</option>)}
                  </select>
                </label>
                <div className={`flex flex-wrap gap-1 ${limitPalette ? "" : "opacity-40"}`} aria-label="Active palette swatches">
                  {activePalette.slice(0, colorCount).map((c) => (
                    <span key={c} title={c} className="size-5 rounded-sm border border-black/20" style={{ background: c }} />
                  ))}
                </div>
                <label className={`flex items-center gap-1.5 ${limitPalette ? "" : "opacity-40"}`}>
                  <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} style={rangeStyle} disabled={!limitPalette} /> Floyd–Steinberg dithering
                </label>
                <label>Brightness: <span className="font-mono">{bright}</span>
                  <input type="range" min={-80} max={80} value={bright} onChange={(e) => setBright(+e.target.value)} className={rangeCls} style={rangeStyle} />
                </label>
                <label>Contrast: <span className="font-mono">{contrast}</span>
                  <input type="range" min={-100} max={100} value={contrast} onChange={(e) => setContrast(+e.target.value)} className={rangeCls} style={rangeStyle} />
                </label>
                <div className="flex gap-1.5">
                  <Btn primary onClick={convert}>Convert</Btn>
                  {previewUrl && <Btn onClick={useAsCanvas}>Edit result</Btn>}
                </div>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Pixel art conversion preview" className="pixel w-full rounded border" style={{ borderColor: "var(--border)" }} />
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--muted)" }}>Load an image and press Convert — preview appears here before export.</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-1.5">
                  <input value={newPalName} onChange={(e) => setNewPalName(e.target.value)} placeholder="New palette name" aria-label="New palette name" className="min-w-0 flex-1 rounded border px-2 py-1.5 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--panel)" }} />
                  <Btn onClick={savePalette}>Save</Btn>
                </div>
                <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>Save extracts up to 32 colors from the current canvas.</p>
                <ul className="flex flex-col gap-1.5">
                  {palettes.map((p) => (
                    <li key={p.name} className="rounded border px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-bold">{p.name}</span>
                        <button
                          onClick={async () => {
                            const next = palettes.filter((x) => x.name !== p.name);
                            setPalettes(next);
                            await kvSet("palettes", next);
                            notify("Palette deleted");
                          }}
                          className="ms-auto text-[12px] hover:underline"
                          style={{ color: "var(--danger)" }}
                        >
                          Delete
                        </button>
                      </div>
                      <span className="mt-1 flex flex-wrap gap-1">{p.colors.map((c) => <span key={c} title={c} className="size-4 rounded-sm border border-black/20" style={{ background: c }} />)}</span>
                    </li>
                  ))}
                  {palettes.length === 0 && <li className="text-[12.5px]" style={{ color: "var(--muted)" }}>No custom palettes yet.</li>}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      <StatusBar
        items={[
          <span key="n">pixel-art-{dims[0]}.png</span>,
          dirty ? <span key="s" style={{ color: "var(--warn)" }}>● Unsaved</span> : <span key="s">Saved locally</span>,
          <span key="d">{dims[0]}×{dims[1]} · {zoom * 100}%</span>,
        ]}
      />
    </div>
  );
}
