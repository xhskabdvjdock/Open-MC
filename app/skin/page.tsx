"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Upload, Eraser, Save } from "lucide-react";
import { useApp } from "@/components/Providers";
import { PixelEditor, type PixelEditorHandle } from "@/components/PixelEditor";
import { Skin3D } from "@/components/Skin3D";
import { Btn, Tabs, SectionLabel, StatusBar } from "@/components/ui";
import { loadImage, isValidSkinSize, downloadBlob } from "@/lib/pixel-utils";
import { saveProject, getProject, uid, kvGet } from "@/lib/storage";
import { consumeNewProject } from "@/components/NewProjectDialog";
import { consumeOpenProject } from "@/lib/projects";

function blankCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.clearRect(0, 0, w, h);
  return c;
}

function mannequinCanvas(): HTMLCanvasElement {
  const c = blankCanvas(64, 64);
  const ctx = c.getContext("2d")!;
  const skin = "#c98e5f", shirt = "#2f9e6e", pants = "#3b5bdb";
  const rect = (x: number, y: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  rect(8, 8, 8, 8, skin);
  rect(20, 20, 8, 12, shirt);
  rect(44, 20, 4, 12, skin);
  rect(36, 52, 4, 12, skin);
  rect(4, 20, 4, 12, pants);
  rect(20, 52, 4, 12, pants);
  return c;
}

const PARTS: { id: string; label: string; region: [number, number, number, number] }[] = [
  { id: "head", label: "Head", region: [8, 8, 8, 8] },
  { id: "head-o", label: "Head · outer", region: [40, 8, 8, 8] },
  { id: "body", label: "Body", region: [20, 20, 8, 12] },
  { id: "body-o", label: "Body · outer", region: [20, 36, 8, 12] },
  { id: "arm-r", label: "Right arm", region: [44, 20, 4, 12] },
  { id: "arm-l", label: "Left arm", region: [36, 52, 4, 12] },
  { id: "leg-r", label: "Right leg", region: [4, 20, 4, 12] },
  { id: "leg-l", label: "Left leg", region: [20, 52, 4, 12] },
];

export default function SkinPage() {
  const { notify, autosave, showGrid, setProject } = useApp();
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [slim, setSlim] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [visible, setVisible] = useState({ head: true, body: true, lArm: true, rArm: true, lLeg: true, rLeg: true });
  const [paintOn3D, setPaintOn3D] = useState(false);
  const [skinUrl, setSkinUrl] = useState("");
  const [skinName, setSkinName] = useState("my-skin");
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"preview" | "layout">("preview");
  const ref = useRef<PixelEditorHandle>(null);
  const paintingOn3DRef = useRef(false);

  const handle3DPaint = useCallback((x: number, y: number) => {
    ref.current?.paintAt(x, y);
  }, []);
  const handle3DPaintStart = useCallback(() => {
    paintingOn3DRef.current = true;
  }, []);
  const handle3DPaintEnd = useCallback(() => {
    if (paintingOn3DRef.current) {
      paintingOn3DRef.current = false;
      ref.current?.commitStroke();
    }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const seedName = consumeNewProject("skin");
      if (seedName && live) {
        setSkinName(seedName);
        setBase(blankCanvas(64, 64));
        setDirty(true);
        return;
      }
      const openId = consumeOpenProject("skin");
      if (openId && live) {
        const rec = await getProject(openId);
        if (rec && typeof rec.data === "object" && live) {
          try {
            const img = await loadImage(rec.data as Blob);
            if (isValidSkinSize(img.naturalWidth, img.naturalHeight)) {
              const c = blankCanvas(64, 64);
              c.getContext("2d")!.drawImage(img, 0, 0);
              setBase(c);
              setSkinName(rec.name);
              setEditKey((k) => k + 1);
              notify(`Opened "${rec.name}"`);
              return;
            }
          } catch { /* fall through */ }
        }
      }
      if (!live) return;
      const saved = await kvGet<string | null>("autosave-skin", null);
      if (!live) return;
      if (saved) {
        try {
          const img = await loadImage(saved);
          if (img.naturalWidth === 64 && (img.naturalHeight === 64 || img.naturalHeight === 32)) {
            const c = blankCanvas(64, 64);
            c.getContext("2d")!.drawImage(img, 0, 0);
            setBase(c);
            return;
          }
        } catch { /* fall through */ }
      }
      if (live) setBase(blankCanvas(64, 64));
    })();
    return () => { live = false; };
  }, [notify]);

  useEffect(() => {
    setProject({ name: skinName, kind: "Skin", dirty });
  }, [skinName, dirty, setProject]);
  useEffect(() => () => setProject(null), [setProject]);

  const onEdit = useCallback(() => {
    setDirty(true);
    const c = ref.current?.getCanvas();
    if (c) setSkinUrl(c.toDataURL("image/png"));
  }, []);

  useEffect(() => {
    if (base) {
      const t = setTimeout(() => {
        const c = ref.current?.getCanvas();
        if (c) setSkinUrl(c.toDataURL("image/png"));
      }, 150);
      return () => clearTimeout(t);
    }
  }, [base, editKey]);

  useEffect(() => {
    if (!autosave || !dirty) return;
    const id = setTimeout(async () => {
      const c = ref.current?.getCanvas();
      if (c) {
        try {
          const { kvSet } = await import("@/lib/storage");
          await kvSet("autosave-skin", c.toDataURL("image/png"));
          setDirty(false);
        } catch { /* ignore */ }
      }
    }, 2000);
    return () => clearTimeout(id);
  }, [autosave, dirty, skinUrl]);

  const importBytes = useCallback(async (blob: Blob, name: string) => {
    try {
      const img = await loadImage(blob);
      if (!isValidSkinSize(img.naturalWidth, img.naturalHeight)) {
        notify(`Invalid skin size ${img.naturalWidth}×${img.naturalHeight}. Use 64×64 or 64×32.`, "err");
        return;
      }
      const c = blankCanvas(64, 64);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      setBase(c);
      setEditKey((k) => k + 1);
      setSkinName(name);
      setDirty(true);
      notify("Skin imported");
    } catch {
      notify("Could not decode image.", "err");
    }
  }, [notify]);

  const importSkin = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    await importBytes(f, f.name.replace(/\.(png|jpg|jpeg)$/i, ""));
  }, [importBytes]);

  const persist = useCallback(async () => {
    const blob = await ref.current?.getBlob();
    if (!blob) { notify("Nothing to save.", "err"); return; }
    await saveProject({ id: uid("skin"), kind: "skin", name: skinName, updatedAt: Date.now(), data: blob, meta: { slim } });
    setDirty(false);
    notify("Saved to projects");
  }, [notify, skinName, slim]);

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

  // shortcuts: Ctrl+S persist · Ctrl+E export
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!(e.ctrlKey || e.metaKey) || typing) return;
      if (e.key.toLowerCase() === "s") { e.preventDefault(); void persist(); }
      if (e.key.toLowerCase() === "e") { e.preventDefault(); void exportSkin(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist, exportSkin]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={skinName}
          onChange={(e) => { setSkinName(e.target.value); setDirty(true); }}
          aria-label="Skin name"
          spellCheck={false}
          className="w-44 rounded border border-transparent bg-transparent px-2 py-1 text-[14px] font-bold outline-none"
          onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border)")}
          onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "transparent")}
        />
        <span className="flex items-center gap-1.5 font-mono text-[11.5px]" style={{ color: "var(--muted)" }} role="status">
          <span className="inline-block size-2 rounded-full" style={{ background: dirty ? "var(--warn)" : "var(--accent)" }} />
          {dirty ? "Unsaved changes" : "Saved locally"}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          <Btn onClick={persist} title="Save to projects (Ctrl+S)">
            <Save className="size-4" aria-hidden /> Save
          </Btn>
          <Btn primary onClick={exportSkin} title="Export PNG (Ctrl+E)">
            <Download className="size-4" aria-hidden /> Export PNG
          </Btn>
        </span>
      </div>

      <div className="flex min-h-[520px] flex-1 flex-col gap-0 lg:flex-row" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
        {/* tools rail */}
        <div className="flex shrink-0 flex-row gap-4 overflow-x-auto border-b p-3 lg:w-52 lg:flex-col lg:gap-3 lg:overflow-visible lg:border-b-0 lg:border-e" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-36">
            <SectionLabel>Canvas</SectionLabel>
            <div className="flex flex-col gap-1">
              <RailBtn onClick={() => { setBase(blankCanvas(64, 64)); setEditKey((k) => k + 1); setDirty(true); }}>Blank 64×64</RailBtn>
              <RailBtn onClick={() => { setBase(mannequinCanvas()); setEditKey((k) => k + 1); setDirty(true); }}>Mannequin guide</RailBtn>
              <label className="ui-transition flex cursor-pointer items-center gap-1.5 rounded border px-2 py-[7px] text-[12.5px] font-semibold" style={{ borderColor: "var(--border)" }}>
                <Upload className="size-3.5" aria-hidden style={{ color: "var(--muted)" }} /> Import…
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={async (e) => { if (e.target.files) await importSkin([...e.target.files]); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          <div className="min-w-36">
            <SectionLabel>Model</SectionLabel>
            <div className="flex flex-col gap-1 text-[12.5px]">
              <label className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1">
                <input type="radio" checked={!slim} onChange={() => setSlim(false)} style={{ accentColor: "var(--accent)" }} /> Steve · 4px arms
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-1">
                <input type="radio" checked={slim} onChange={() => setSlim(true)} style={{ accentColor: "var(--accent)" }} /> Alex · slim arms
              </label>
            </div>
          </div>
          <div className="min-w-36">
            <SectionLabel>Layer</SectionLabel>
            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-1.5 px-1 py-1 text-[12.5px]">
                <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Outer layer
              </label>
              <RailBtn onClick={clearOverlay}>
                <span className="flex items-center gap-1.5"><Eraser className="size-3.5" aria-hidden style={{ color: "var(--muted)" }} /> Erase outer layer</span>
              </RailBtn>
            </div>
          </div>
        </div>

        {/* center */}
        <div className="flex min-w-0 flex-1 flex-col" style={{ background: "var(--bg)" }}>
          <div className="px-3 pt-2" style={{ background: "var(--panel)" }}>
            <Tabs
              ariaLabel="Skin view"
              active={view}
              onChange={setView}
              tabs={[
                { id: "preview", label: "3D Preview" },
                { id: "layout", label: "2D Layout" },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {/* Both views stay mounted so switching tabs never loses edits. */}
            <div className={view === "preview" ? "" : "hidden"}>
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded border px-2 py-1.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
                <label className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: paintOn3D ? "var(--accent)" : "var(--muted)" }}>
                  <input type="checkbox" checked={paintOn3D} onChange={(e) => setPaintOn3D(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
                  Paint on 3D
                </label>
                <span className="text-[11px]" style={{ color: "var(--faint)" }}>{paintOn3D ? "Click/drag on model to paint" : "Drag to rotate"}</span>
                <span className="ms-auto flex flex-wrap items-center gap-1 text-[11px]">
                  {([
                    ["head", "Head"],
                    ["body", "Body"],
                    ["rArm", "R-Arm"],
                    ["lArm", "L-Arm"],
                    ["rLeg", "R-Leg"],
                    ["lLeg", "L-Leg"],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-1 rounded border px-1.5 py-0.5" style={{ borderColor: visible[k as keyof typeof visible] ? "var(--accent)" : "var(--border)", opacity: visible[k as keyof typeof visible] ? 1 : 0.45 }}>
                      <input
                        type="checkbox"
                        checked={visible[k as keyof typeof visible]}
                        onChange={(e) => setVisible((v) => ({ ...v, [k]: e.target.checked }))}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {label}
                    </label>
                  ))}
                </span>
              </div>
              {skinUrl ? (
                <Skin3D
                  skinUrl={skinUrl}
                  slim={slim}
                  showOverlay={showOverlay}
                  visible={visible}
                  paintMode={paintOn3D}
                  onPaint={handle3DPaint}
                  onPaintStart={handle3DPaintStart}
                  onPaintEnd={handle3DPaintEnd}
                />
              ) : (
                <p className="py-16 text-center text-[13px]" style={{ color: "var(--muted)" }}>Preparing preview…</p>
              )}
            </div>
            <div className={view === "layout" ? "" : "hidden"}>
              {base && (
                <PixelEditor key={editKey} ref={ref} width={64} height={64} initialImage={base} showGridDefault={showGrid} onEdit={onEdit} />
              )}
            </div>
          </div>
        </div>

        {/* parts */}
        <aside className="shrink-0 overflow-y-auto border-t p-3 lg:w-56 lg:border-s lg:border-t-0" style={{ borderColor: "var(--border)", background: "var(--panel)" }} aria-label="Skin parts">
          <SectionLabel>Parts · live — click to hide in 3D</SectionLabel>
          <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {PARTS.map((p) => {
              const isOuter = p.id.endsWith("-o");
              const baseId = isOuter ? p.id.slice(0, -2) : p.id;
              // Map part id to visible key: head -> head, body -> body, arm-r -> rArm, etc.
              const visKey = (
                baseId === "head" ? "head" :
                baseId === "body" ? "body" :
                baseId === "arm-r" ? "rArm" :
                baseId === "arm-l" ? "lArm" :
                baseId === "leg-r" ? "rLeg" :
                baseId === "leg-l" ? "lLeg" : null
              ) as keyof typeof visible | null;
              const isVisible = visKey ? visible[visKey] : true;
              const dimmed = isOuter ? (!showOverlay || !isVisible) : !isVisible;
              const toggle = () => {
                if (!visKey) return;
                setVisible((v) => ({ ...v, [visKey]: !v[visKey] }));
              };
              return (
                <li key={p.id}>
                  <button
                    onClick={toggle}
                    className="flex w-full items-center gap-2 rounded border px-2 py-1.5 text-start"
                    style={{ borderColor: isVisible && (!isOuter || showOverlay) ? "var(--border)" : "var(--border)", opacity: dimmed ? 0.35 : 1 }}
                    title={dimmed ? "Hidden in 3D — click to show" : "Visible in 3D — click to hide"}
                  >
                    <PartThumb skinUrl={skinUrl} region={p.region} label={p.label} dimmed={dimmed} />
                    <span className="text-[12px] font-medium">{p.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
            Thumbnails crop the live 64×64 canvas. Click a part to hide/show it in the 3D view — useful to paint occluded areas.
          </p>
        </aside>
      </div>

      <StatusBar
        items={[
          <span key="n">{skinName}.png</span>,
          dirty ? <span key="s" style={{ color: "var(--warn)" }}>● Unsaved</span> : <span key="s">Saved locally</span>,
          <span key="d">64×64</span>,
          <span key="m">{slim ? "Alex" : "Steve"}</span>,
          showOverlay ? <span key="o">Outer on</span> : <span key="o">Outer off</span>,
        ]}
      />
    </div>
  );
}

function RailBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="ui-transition rounded border px-2 py-[7px] text-start text-[12.5px] font-semibold"
      style={{ borderColor: "var(--border)" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)")}
    >
      {children}
    </button>
  );
}

function PartThumb({ skinUrl, region, label, dimmed }: {
  skinUrl: string; region: [number, number, number, number]; label: string; dimmed?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!skinUrl || !ref.current) return;
    const img = new Image();
    img.onload = () => {
      const c = ref.current!;
      const [sx, sy, sw, sh] = region;
      c.width = sw; c.height = sh;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    };
    img.src = skinUrl;
  }, [skinUrl, region]);
  const [, , pW, pH] = region;
  return (
    <canvas
      ref={ref}
      width={pW}
      height={pH}
      className="checker shrink-0 rounded-sm border"
      style={{ width: pW * 3, height: pH * 3, imageRendering: "pixelated", borderColor: "var(--border)", opacity: dimmed ? 0.3 : 1 }}
      role="img"
      aria-label={`${label} region preview`}
    />
  );
}
