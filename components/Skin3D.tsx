"use client";
import React, { useMemo, useState } from "react";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

// CSS-3D Minecraft character. Real geometry textured from the live skin canvas.
interface Props {
  skinUrl: string; // dataURL of 64x64 (or 64x32) skin
  slim?: boolean;  // Alex arms
  showOverlay?: boolean;
}

const S = 7; // display px per texture pixel

function faceStyle(skinUrl: string, ux: number, uy: number, w: number, h: number): React.CSSProperties {
  return {
    backgroundImage: `url(${skinUrl})`,
    backgroundSize: `${64 * S}px ${64 * S}px`,
    backgroundPosition: `-${ux * S}px -${uy * S}px`,
    imageRendering: "pixelated",
    width: w * S,
    height: h * S,
  };
}

function Box({ w, h, d, faces, transform }: {
  w: number; h: number; d: number;
  faces: { front: React.CSSProperties; back: React.CSSProperties; left: React.CSSProperties; right: React.CSSProperties; top: React.CSSProperties; bottom: React.CSSProperties };
  transform: string;
}) {
  const ws = w * S, hs = h * S, ds = d * S;
  const base: React.CSSProperties = { position: "absolute", imageRendering: "pixelated" as const };
  return (
    <div style={{ position: "absolute", transformStyle: "preserve-3d", transform, width: ws, height: hs }}>
      <div style={{ ...base, ...faces.front, transform: `translateZ(${ds / 2}px)` }} />
      <div style={{ ...base, ...faces.back, transform: `rotateY(180deg) translateZ(${ds / 2}px)` }} />
      <div style={{ ...base, ...faces.right, width: ds, height: hs, left: (ws - ds) / 2, transform: `rotateY(-90deg) translateZ(${ws / 2}px)` }} />
      <div style={{ ...base, ...faces.left, width: ds, height: hs, left: (ws - ds) / 2, transform: `rotateY(90deg) translateZ(${ws / 2}px)` }} />
      <div style={{ ...base, ...faces.top, width: ws, height: ds, top: (hs - ds) / 2, transform: `rotateX(90deg) translateZ(${hs / 2}px)` }} />
      <div style={{ ...base, ...faces.bottom, width: ws, height: ds, top: (hs - ds) / 2, transform: `rotateX(-90deg) translateZ(${hs / 2}px)` }} />
    </div>
  );
}

export function Skin3D({ skinUrl, slim = false, showOverlay = true }: Props) {
  const [yaw, setYaw] = useState(-24);
  const [pitch, setPitch] = useState(-8);
  const [zoom, setZoom] = useState(1);
  const drag = React.useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);

  const armW = slim ? 3 : 4;

  const parts = useMemo(() => {
    const f = (ux: number, uy: number, w: number, h: number) => faceStyle(skinUrl, ux, uy, w, h);
    const head = {
      front: f(8, 8, 8, 8), back: f(24, 8, 8, 8), left: f(16, 8, 8, 8),
      right: f(0, 8, 8, 8), top: f(8, 0, 8, 8), bottom: f(16, 0, 8, 8),
    };
    const headO = {
      front: f(40, 8, 8, 8), back: f(56, 8, 8, 8), left: f(48, 8, 8, 8),
      right: f(32, 8, 8, 8), top: f(40, 0, 8, 8), bottom: f(48, 0, 8, 8),
    };
    const body = {
      front: f(20, 20, 8, 12), back: f(32, 20, 8, 12), left: f(28, 20, 4, 12),
      right: f(16, 20, 4, 12), top: f(20, 16, 8, 4), bottom: f(28, 16, 8, 4),
    };
    const bodyO = {
      front: f(20, 36, 8, 12), back: f(32, 36, 8, 12), left: f(28, 36, 4, 12),
      right: f(16, 36, 4, 12), top: f(20, 32, 8, 4), bottom: f(28, 32, 8, 4),
    };
    // Right arm (classic origin 40,16)
    const rArm = {
      front: f(44, 20, 4, 12), back: f(52, 20, 4, 12), left: f(48, 20, 4, 12),
      right: f(40, 20, 4, 12), top: f(44, 16, 4, 4), bottom: f(48, 16, 4, 4),
    };
    const rArmO = {
      front: f(44, 36, 4, 12), back: f(52, 36, 4, 12), left: f(48, 36, 4, 12),
      right: f(40, 36, 4, 12), top: f(44, 32, 4, 4), bottom: f(48, 32, 4, 4),
    };
    // Right leg (origin 0,16)
    const rLeg = {
      front: f(4, 20, 4, 12), back: f(12, 20, 4, 12), left: f(8, 20, 4, 12),
      right: f(0, 20, 4, 12), top: f(4, 16, 4, 4), bottom: f(8, 16, 4, 4),
    };
    const rLegO = {
      front: f(4, 36, 4, 12), back: f(12, 36, 4, 12), left: f(8, 36, 4, 12),
      right: f(0, 36, 4, 12), top: f(4, 32, 4, 4), bottom: f(8, 32, 4, 4),
    };
    // Left leg (origin 16,48)
    const lLeg = {
      front: f(20, 52, 4, 12), back: f(28, 52, 4, 12), left: f(24, 52, 4, 12),
      right: f(16, 52, 4, 12), top: f(20, 48, 4, 4), bottom: f(24, 48, 4, 4),
    };
    const lLegO = {
      front: f(4, 52, 4, 12), back: f(12, 52, 4, 12), left: f(8, 52, 4, 12),
      right: f(0, 52, 4, 12), top: f(4, 48, 4, 4), bottom: f(8, 48, 4, 4),
    };
    // Left arm (origin 32,48)
    const lArm = {
      front: f(36, 52, 4, 12), back: f(44, 52, 4, 12), left: f(40, 52, 4, 12),
      right: f(32, 52, 4, 12), top: f(36, 48, 4, 4), bottom: f(40, 48, 4, 4),
    };
    const lArmO = {
      front: f(52, 52, 4, 12), back: f(60, 52, 4, 12), left: f(56, 52, 4, 12),
      right: f(48, 52, 4, 12), top: f(52, 48, 4, 4), bottom: f(56, 48, 4, 4),
    };
    return { head, headO, body, bodyO, rArm, rArmO, rLeg, rLegO, lLeg, lLegO, lArm, lArmO };
  }, [skinUrl]);

  // layout offsets (display px): character total height = 8+12+12 head+body+legs in texture px
  const o = 1.02; // overlay slightly larger
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative mx-auto w-full max-w-105 cursor-grab overflow-hidden rounded-md border border-slate-200 bg-slate-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950"
        style={{ height: 380, perspective: 900 }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setYaw(drag.current.yaw + (e.clientX - drag.current.x) * 0.6);
          setPitch(Math.max(-60, Math.min(60, drag.current.pitch - (e.clientY - drag.current.y) * 0.4)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
        role="application"
        aria-label="3D skin preview. Drag to rotate."
      >
        <div className="absolute left-1/2 top-1/2" style={{ transformStyle: "preserve-3d", transform: `translate(-50%,-50%) scale(${zoom}) rotateX(${pitch}deg) rotateY(${yaw}deg)` }}>
          {/* head */}
          <Box w={8} h={8} d={8} faces={parts.head} transform={`translate(${-4 * S}px, ${-20 * S}px)`} />
          {showOverlay && <Box w={8} h={8} d={8} faces={parts.headO} transform={`translate(${-4 * S}px, ${-20 * S}px) scale(${o})`} />}
          {/* body */}
          <Box w={8} h={12} d={4} faces={parts.body} transform={`translate(${-4 * S}px, ${-12 * S}px)`} />
          {showOverlay && <Box w={8} h={12} d={4} faces={parts.bodyO} transform={`translate(${-4 * S}px, ${-12 * S}px) scale(${o})`} />}
          {/* right arm */}
          <Box w={armW} h={12} d={4} faces={parts.rArm} transform={`translate(${(-4 - armW) * S}px, ${-12 * S}px)`} />
          {showOverlay && <Box w={armW} h={12} d={4} faces={parts.rArmO} transform={`translate(${(-4 - armW) * S}px, ${-12 * S}px) scale(${o})`} />}
          {/* left arm */}
          <Box w={armW} h={12} d={4} faces={parts.lArm} transform={`translate(${4 * S}px, ${-12 * S}px)`} />
          {showOverlay && <Box w={armW} h={12} d={4} faces={parts.lArmO} transform={`translate(${4 * S}px, ${-12 * S}px) scale(${o})`} />}
          {/* right leg */}
          <Box w={4} h={12} d={4} faces={parts.rLeg} transform={`translate(${-4 * S}px, ${0 * S}px)`} />
          {showOverlay && <Box w={4} h={12} d={4} faces={parts.rLegO} transform={`translate(${-4 * S}px, ${0 * S}px) scale(${o})`} />}
          {/* left leg */}
          <Box w={4} h={12} d={4} faces={parts.lLeg} transform={`translate(${0 * S}px, ${0 * S}px)`} />
          {showOverlay && <Box w={4} h={12} d={4} faces={parts.lLegO} transform={`translate(${0 * S}px, ${0 * S}px) scale(${o})`} />}
        </div>
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white/95 p-1 text-[12px] dark:border-slate-700 dark:bg-slate-900/95">
          {([["Front", 0], ["Back", 180], ["Left", 90], ["Right", -90]] as const).map(([label, y]) => (
            <button key={label} onClick={() => { setYaw(y); setPitch(-8); }} className={`rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${Math.round(yaw % 360) === y ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : ""}`}>
              {label}
            </button>
          ))}
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} aria-label="Zoom out" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut className="size-3.5" /></button>
          <span className="font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} aria-label="Zoom in" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn className="size-3.5" /></button>
          <button onClick={() => { setYaw((y) => y + 45); }} aria-label="Rotate" title="Rotate 45°" className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><RotateCw className="size-3.5" /></button>
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">Drag to rotate · live from your edits{slim ? " · Alex (slim) arms" : " · Steve arms"}</p>
    </div>
  );
}
