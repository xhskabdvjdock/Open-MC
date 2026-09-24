"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PersonStanding, Download, Upload, Eraser } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { PixelEditor, type PixelEditorHandle } from "@/components/PixelEditor";
import { Skin3D } from "@/components/Skin3D";
import { loadImage, isValidSkinSize, downloadBlob } from "@/lib/pixel-utils";
import { saveProject, uid, kvGet } from "@/lib/storage";

function blankCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  return c;
}

// Procedural CC0 mannequin template (not Mojang's Steve/Alex art): simple two-tone body guide.
function mannequinCanvas(): HTMLCanvasElement {
  const c = blankCanvas(64, 64);
  const ctx = c.getContext("2d")!;
  const skin = "#c98e5f", shirt = "#2f9e6e", pants = "#3b5bdb";
  const rect = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  rect(8, 8, 8, 8, skin);            // head front
  rect(20, 20, 8, 12, shirt);        // body front
  rect(44, 20, 4, 12, skin);         // right arm
  rect(36, 52, 4, 12, skin);         // left arm
  rect(4, 20, 4, 12, pants);         // right leg
  rect(20, 52, 4, 12, pants);        // left leg
  return c;
}

export default function SkinPage() {
  const { notify, autosave } = useApp();
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [slim, setSlim] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [skinUrl, setSkinUrl] = useState("");
  const [skinName, setSkinName] = useState("my-skin");
  const [dirty, setDirty] = useState(false);
  const ref = useRef<PixelEditorHandle>(null);

  useEffect(() => {
    let live = true;
    kvGet<string | null>("autosave-skin", null).then(async (saved) => {
      if (!live) return;
      if (saved) {
        try {
          const img = await loadImage(saved);
          if (!live) return;
          if (img.naturalWidth === 64 && (img.naturalHeight === 64 || img.naturalHeight === 32)) {
            const c = blankCanvas(64, 64);
            c.getContext("2d")!.drawImage(img, 0, 0);
            setBase(c);
            return;
          }
        } catch { /* fall through to blank */ }
      }
      if (live) setBase(blankCanvas(64, 64));
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    // initial preview once base is set
    if (base) {
      const t = setTimeout(() => {
        const c = ref.current?.getCanvas();
        if (c) setSkinUrl(c.toDataURL("image/png"));
      }, 150);
      return () => clearTimeout(t);
    }
  }, [base, editKey]);

  const onEdit = useCallback(() => {
    setDirty(true);
    // debounce preview so 3D stays live but cheap
    const c = ref.current?.getCanvas();
    if (c) setSkinUrl(c.toDataURL("image/png"));
  }, []);

  useEffect(() => {
    if (!autosave || !dirty) return;
    const id = setTimeout(async () => {
      const c = ref.current?.getCanvas();
      if (c) {
        try {
          await kvSetSafe("autosave-skin", c.toDataURL("image/png"));
          setDirty(false);
        } catch { /* ignore */ }
      }
    }, 2000);
    return () => clearTimeout(id);
  }, [autosave, dirty, skinUrl]);

  const importSkin = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    try {
      const img = await loadImage(f);
      if (!isValidSkinSize(img.naturalWidth, img.naturalHeight)) {
        notify(`Invalid skin size ${img.naturalWidth}×${img.naturalHeight}. Use 64×64 or 64×32.`, "err");
        return;
      }
      const c = blankCanvas(64, 64);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      // 64x32 legacy → copy right limbs to left slots is handled by renderer fallback; keep as-is
      setBase(c);
      setEditKey((k) => k + 1);
      setSkinName(f.name.replace(/\.(png|jpg|jpeg)$/i, ""));
      setDirty(true);
      notify("Skin imported");
    } catch {
      notify("Could not decode image.", "err");
    }
  }, [notify]);

  const exportSkin = useCallback(async () => {
    const blob = await ref.current?.getBlob();
    if (!blob) { notify("Nothing to export.", "err"); return; }
    downloadBlob(blob, `${skinName || "skin"}.png`);
    await saveProject({ id: uid("skin"), kind: "skin", name: skinName, updatedAt: Date.now(), data: blob, meta: { slim } });
    setDirty(false);
    notify("Exported");
  }, [notify, skinName, slim]);

  const clearOverlay = useCallback(() => {
    const c = ref.current?.getCanvas();
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    // overlay regions on 64x64
    const regions: [number, number, number, number][] = [
      [32, 0, 32, 16], [16, 32, 32, 16], [40, 32, 16, 16],
      [0, 32, 16, 16], [0, 48, 16, 16], [48, 48, 16, 16],
    ];
    const img = ctx.getImageData(0, 0, 64, 64);
    for (const [x, y, w, h] of regions) {
      for (let py = y; py < y + h; py++)
        for (let px = x; px < x + w; px++) {
          img.data[(py * 64 + px) * 4 + 3] = 0;
        }
    }
    ctx.putImageData(img, 0, 0);
    ref.current?.clearHistory();
    onEdit();
    notify("Outer layer cleared");
  }, [notify, onEdit]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><PersonStanding className="size-5 text-emerald-600" aria-hidden /> Skin Studio</h1>
        <span className="text-[12px] text-slate-500">{dirty ? "unsaved changes" : "saved locally"}</span>
        <span className="ms-auto flex items-center gap-1.5">
          <input value={skinName} onChange={(e) => setSkinName(e.target.value)} aria-label="Skin name" className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
          <button onClick={exportSkin} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
            <Download className="size-4" aria-hidden /> Export PNG
          </button>
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button onClick={() => { setBase(blankCanvas(64, 64)); setEditKey((k) => k + 1); }} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">Blank 64×64</button>
        <button onClick={() => { setBase(mannequinCanvas()); setEditKey((k) => k + 1); setDirty(true); }} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">Mannequin guide (CC0)</button>
        <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">
          <Upload className="size-4" aria-hidden /> Import skin…
          <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { if (e.target.files) await importSkin([...e.target.files]); e.target.value = ""; }} />
        </label>
      </div>
      <Dropzone accept="image/png,image/jpeg" onFiles={importSkin} label="Or drop a skin PNG here" hint="64×64 or legacy 64×32 · never stretched · validated on import" compact />

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] dark:border-slate-700 dark:bg-slate-900">
        <span className="font-semibold">Model:</span>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={!slim} onChange={() => setSlim(false)} className="accent-emerald-600" /> Steve (classic 4px arms)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={slim} onChange={() => setSlim(true)} className="accent-emerald-600" /> Alex (slim 3px arms)
        </label>
        <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} className="accent-emerald-600" /> Outer layer
        </label>
        <button onClick={clearOverlay} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[12px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          <Eraser className="size-3.5" aria-hidden /> Erase outer layer
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section aria-label="2D skin editor">
          <h2 className="mb-1.5 text-[13px] font-bold">2D layout — true 64×64, undistorted</h2>
          {base && (
            <PixelEditor key={editKey} ref={ref} width={64} height={64} initialImage={base} onEdit={onEdit} />
          )}
        </section>
        <section aria-label="3D preview">
          <h2 className="mb-1.5 text-[13px] font-bold">3D preview — live</h2>
          {skinUrl ? (
            <Skin3D skinUrl={skinUrl} slim={slim} showOverlay={showOverlay} />
          ) : (
            <div className="grid h-64 place-items-center rounded-md border border-dashed border-slate-300 text-[13px] text-slate-500">Edit the skin to see the 3D preview</div>
          )}
        </section>
      </div>
    </div>
  );
}

async function kvSetSafe(key: string, value: string) {
  const { kvSet } = await import("@/lib/storage");
  await kvSet(key, value);
}
