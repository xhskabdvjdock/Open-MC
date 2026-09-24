"use client";
import React, { useMemo, useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, AlertTriangle } from "lucide-react";

export interface McModelElement {
  from?: [number, number, number];
  to?: [number, number, number];
  faces?: Record<string, { texture?: string; cullface?: string }>;
  shade?: boolean;
}
export interface McModel {
  parent?: string;
  textures?: Record<string, string>;
  elements?: McModelElement[];
  display?: unknown;
  gui_light?: string;
  ambientocclusion?: boolean;
}

// Renders block-model `elements` as CSS-3D boxes with neutral material when
// textures can't be resolved (honest: labels show texture variable instead of fake art).
const PALETTE = ["#8ecae6", "#90be6d", "#f9c74f", "#f3722c", "#f94144", "#577590", "#b56576", "#6d597a"];

export function ModelPreview({ model }: { model: McModel | null }) {
  const [yaw, setYaw] = useState(-28);
  const [pitch, setPitch] = useState(-18);
  const [zoom, setZoom] = useState(1);
  const drag = React.useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const elements = useMemo(() => {
    if (!model?.elements?.length) return [];
    return model.elements.slice(0, 48).map((el, i) => {
      const from = el.from ?? [0, 0, 0];
      const to = el.to ?? [16, 16, 16];
      const size: [number, number, number] = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const center: [number, number, number] = [
        (from[0] + to[0]) / 2 - 8,
        -((from[1] + to[1]) / 2 - 8),
        (from[2] + to[2]) / 2 - 8,
      ];
      return { el, i, size, center, color: PALETTE[i % PALETTE.length] };
    });
  }, [model]);

  if (!model) {
    return (
      <div className="grid h-64 place-items-center rounded-md border border-dashed border-slate-300 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No model loaded
      </div>
    );
  }
  if (!elements.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-4 text-center text-[13px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="size-5" aria-hidden />
        <p className="font-semibold">Preview unavailable</p>
        <p className="max-w-80 text-[12px] opacity-90">
          {model.parent ? `This model inherits from "${model.parent}" and defines no elements of its own, so there is no local geometry to render.` : "This JSON defines no renderable elements."}
        </p>
      </div>
    );
  }

  const K = 9; // px per model unit
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative mx-auto w-full cursor-grab overflow-hidden rounded-md border border-slate-200 bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950"
        style={{ height: 360, perspective: 1000 }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setYaw(drag.current.yaw + (e.clientX - drag.current.x) * 0.5);
          setPitch(Math.max(-70, Math.min(70, drag.current.pitch - (e.clientY - drag.current.y) * 0.4)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
        role="application"
        aria-label="3D model preview. Drag to rotate."
      >
        <div className="absolute left-1/2 top-1/2" style={{ transformStyle: "preserve-3d", transform: `translate(-50%,-50%) scale(${zoom}) rotateX(${pitch}deg) rotateY(${yaw}deg)` }}>
          {elements.map(({ i, size, center, color, el }) => {
            const w = Math.max(1, size[0] * K), h = Math.max(1, size[1] * K), d = Math.max(1, size[2] * K);
            const face = (): React.CSSProperties => ({
              position: "absolute", background: `${color}cc`, border: "1px solid rgba(0,0,0,.45)",
              display: "grid", placeItems: "center", fontSize: 9, color: "#000", fontWeight: 700,
            });
            const texLabel = el.faces ? Object.entries(el.faces).slice(0, 2).map(([f, v]) => `${f}:${v.texture ?? "?"}`).join(" ") : "";
            return (
              <div key={i} title={texLabel} style={{ position: "absolute", transformStyle: "preserve-3d", transform: `translate3d(${center[0] * K - w / 2}px, ${center[1] * K - h / 2}px, ${center[2] * K}px)`, width: w, height: h }}>
                <div style={{ ...face(), width: w, height: h, transform: `translateZ(${d / 2}px)` }}>{i}</div>
                <div style={{ ...face(), width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)` }} />
                <div style={{ ...face(), width: d, height: h, left: (w - d) / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)` }} />
                <div style={{ ...face(), width: d, height: h, left: (w - d) / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }} />
                <div style={{ ...face(), width: w, height: d, top: (h - d) / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)` }} />
                <div style={{ ...face(), width: w, height: d, top: (h - d) / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }} />
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 dark:border-slate-700 dark:bg-slate-900/95">
          <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))} aria-label="Zoom out" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut className="size-3.5" /></button>
          <span className="font-mono text-[12px]">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))} aria-label="Zoom in" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn className="size-3.5" /></button>
          <button onClick={() => setYaw((y) => y + 45)} aria-label="Rotate" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><RotateCw className="size-3.5" /></button>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
        {elements.length} element{elements.length === 1 ? "" : "s"} · neutral material (pack textures are referenced by name, not embedded)
      </p>
    </div>
  );
}
