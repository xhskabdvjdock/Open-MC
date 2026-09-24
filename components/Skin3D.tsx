"use client";
import React, { useMemo, useState } from "react";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

// CSS-3D Minecraft character. Real geometry textured from the live skin canvas.
interface Props {
  skinUrl: string; // dataURL of 64x64 (or 64x32) skin
  slim?: boolean;  // Alex arms
  showOverlay?: boolean;
  visible?: { head: boolean; body: boolean; lArm: boolean; rArm: boolean; lLeg: boolean; rLeg: boolean };
  paintMode?: boolean;
  onPaint?: (x: number, y: number) => void;
  onPaintStart?: () => void;
  onPaintEnd?: () => void;
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

function paintForFace(
  ux: number, uy: number, w: number, h: number,
  paintMode: boolean | undefined,
  onPaint: ((x: number, y: number) => void) | undefined,
  onPaintStart?: () => void,
  onPaintEnd?: () => void
) {
  if (!paintMode || !onPaint) return {};
  const handler = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    let lx = (e.nativeEvent as PointerEvent).offsetX;
    let ly = (e.nativeEvent as PointerEvent).offsetY;
    if (lx === undefined || ly === undefined || (lx === 0 && ly === 0)) {
      const r = target.getBoundingClientRect();
      lx = e.clientX - r.left;
      ly = e.clientY - r.top;
      const scaleX = (w * S) / r.width;
      const scaleY = (h * S) / r.height;
      lx *= scaleX;
      ly *= scaleY;
    }
    const px = Math.floor(lx / S);
    const py = Math.floor(ly / S);
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    onPaint(ux + px, uy + py);
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onPaintStart?.();
      handler(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.buttons !== 1) return;
      e.stopPropagation();
      handler(e);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.stopPropagation();
      onPaintEnd?.();
    },
    style: { cursor: "crosshair", touchAction: "none" } as React.CSSProperties,
  };
}

function Box({ w, h, d, faces, transform, paintHandlers }: {
  w: number; h: number; d: number;
  faces: { front: React.CSSProperties; back: React.CSSProperties; left: React.CSSProperties; right: React.CSSProperties; top: React.CSSProperties; bottom: React.CSSProperties };
  transform: string;
  paintHandlers?: {
    front: { ux: number; uy: number; w: number; h: number };
    back: { ux: number; uy: number; w: number; h: number };
    left: { ux: number; uy: number; w: number; h: number };
    right: { ux: number; uy: number; w: number; h: number };
    top: { ux: number; uy: number; w: number; h: number };
    bottom: { ux: number; uy: number; w: number; h: number };
  } & { paintMode?: boolean; onPaint?: (x: number, y: number) => void; onPaintStart?: () => void; onPaintEnd?: () => void };
}) {
  const ws = w * S, hs = h * S, ds = d * S;
  const base: React.CSSProperties = { position: "absolute", imageRendering: "pixelated" as const };
  const fh = paintHandlers;
  const pm = fh?.paintMode;
  const op = fh?.onPaint;
  const ops = fh?.onPaintStart;
  const ope = fh?.onPaintEnd;
  const getFaceProps = (f: { ux: number; uy: number; w: number; h: number }) =>
    fh ? paintForFace(f.ux, f.uy, f.w, f.h, pm, op, ops, ope) : ({} as Record<string, unknown>);
  const frontProps = getFaceProps(fh?.front ?? { ux: 0, uy: 0, w: 0, h: 0 });
  const backProps = getFaceProps(fh?.back ?? { ux: 0, uy: 0, w: 0, h: 0 });
  const rightProps = getFaceProps(fh?.right ?? { ux: 0, uy: 0, w: 0, h: 0 });
  const leftProps = getFaceProps(fh?.left ?? { ux: 0, uy: 0, w: 0, h: 0 });
  const topProps = getFaceProps(fh?.top ?? { ux: 0, uy: 0, w: 0, h: 0 });
  const bottomProps = getFaceProps(fh?.bottom ?? { ux: 0, uy: 0, w: 0, h: 0 });
  return (
    <div style={{ position: "absolute", transformStyle: "preserve-3d", transform, width: ws, height: hs }}>
      <div style={{ ...base, ...faces.front, transform: `translateZ(${ds / 2}px)`, ...(frontProps as { style?: object })?.style as object }} {...(frontProps as object)} />
      <div style={{ ...base, ...faces.back, transform: `rotateY(180deg) translateZ(${ds / 2}px)`, ...(backProps as { style?: object })?.style as object }} {...(backProps as object)} />
      <div style={{ ...base, ...faces.right, width: ds, height: hs, left: (ws - ds) / 2, transform: `rotateY(-90deg) translateZ(${ws / 2}px)`, ...(rightProps as { style?: object })?.style as object }} {...(rightProps as object)} />
      <div style={{ ...base, ...faces.left, width: ds, height: hs, left: (ws - ds) / 2, transform: `rotateY(90deg) translateZ(${ws / 2}px)`, ...(leftProps as { style?: object })?.style as object }} {...(leftProps as object)} />
      <div style={{ ...base, ...faces.top, width: ws, height: ds, top: (hs - ds) / 2, transform: `rotateX(90deg) translateZ(${hs / 2}px)`, ...(topProps as { style?: object })?.style as object }} {...(topProps as object)} />
      <div style={{ ...base, ...faces.bottom, width: ws, height: ds, top: (hs - ds) / 2, transform: `rotateX(-90deg) translateZ(${hs / 2}px)`, ...(bottomProps as { style?: object })?.style as object }} {...(bottomProps as object)} />
    </div>
  );
}

export function Skin3D({
  skinUrl,
  slim = false,
  showOverlay = true,
  visible = { head: true, body: true, lArm: true, rArm: true, lLeg: true, rLeg: true },
  paintMode = false,
  onPaint,
  onPaintStart,
  onPaintEnd,
}: Props) {
  const [yaw, setYaw] = useState(-24);
  const [pitch, setPitch] = useState(-8);
  const [zoom, setZoom] = useState(1);
  const drag = React.useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const isPainting = paintMode && !!onPaint;

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

  const boxPaint = (faces: { front: { ux: number; uy: number; w: number; h: number }; back: { ux: number; uy: number; w: number; h: number }; left: { ux: number; uy: number; w: number; h: number }; right: { ux: number; uy: number; w: number; h: number }; top: { ux: number; uy: number; w: number; h: number }; bottom: { ux: number; uy: number; w: number; h: number } }) =>
    isPainting ? { ...faces, paintMode: true as const, onPaint: onPaint!, onPaintStart, onPaintEnd } : undefined;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative mx-auto w-full max-w-105 overflow-hidden rounded-md border ${isPainting ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"} border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950`}
        style={{ height: 380, perspective: 900 }}
        onPointerDown={(e) => {
          if (isPainting) {
            onPaintStart?.();
            return;
          }
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
        }}
        onPointerMove={(e) => {
          if (isPainting) return;
          if (!drag.current) return;
          setYaw(drag.current.yaw + (e.clientX - drag.current.x) * 0.6);
          setPitch(Math.max(-60, Math.min(60, drag.current.pitch - (e.clientY - drag.current.y) * 0.4)));
        }}
        onPointerUp={() => {
          if (isPainting) { onPaintEnd?.(); return; }
          drag.current = null;
        }}
        onPointerLeave={() => {
          if (isPainting) { onPaintEnd?.(); return; }
          drag.current = null;
        }}
        role="application"
        aria-label={isPainting ? "3D skin paint — click/drag on the model to paint" : "3D skin preview. Drag to rotate."}
      >
        <div className="absolute left-1/2 top-1/2" style={{ transformStyle: "preserve-3d", transform: `translate(-50%,-50%) scale(${zoom}) rotateX(${pitch}deg) rotateY(${yaw}deg)` }}>
          {/* head */}
          {visible.head && <Box w={8} h={8} d={8} faces={parts.head} transform={`translate(${-4 * S}px, ${-20 * S}px)`} paintHandlers={boxPaint({ front: { ux: 8, uy: 8, w: 8, h: 8 }, back: { ux: 24, uy: 8, w: 8, h: 8 }, left: { ux: 16, uy: 8, w: 8, h: 8 }, right: { ux: 0, uy: 8, w: 8, h: 8 }, top: { ux: 8, uy: 0, w: 8, h: 8 }, bottom: { ux: 16, uy: 0, w: 8, h: 8 } })} />}
          {visible.head && showOverlay && <Box w={8} h={8} d={8} faces={parts.headO} transform={`translate(${-4 * S}px, ${-20 * S}px) scale(${o})`} paintHandlers={boxPaint({ front: { ux: 40, uy: 8, w: 8, h: 8 }, back: { ux: 56, uy: 8, w: 8, h: 8 }, left: { ux: 48, uy: 8, w: 8, h: 8 }, right: { ux: 32, uy: 8, w: 8, h: 8 }, top: { ux: 40, uy: 0, w: 8, h: 8 }, bottom: { ux: 48, uy: 0, w: 8, h: 8 } })} />}
          {/* body */}
          {visible.body && <Box w={8} h={12} d={4} faces={parts.body} transform={`translate(${-4 * S}px, ${-12 * S}px)`} paintHandlers={boxPaint({ front: { ux: 20, uy: 20, w: 8, h: 12 }, back: { ux: 32, uy: 20, w: 8, h: 12 }, left: { ux: 28, uy: 20, w: 4, h: 12 }, right: { ux: 16, uy: 20, w: 4, h: 12 }, top: { ux: 20, uy: 16, w: 8, h: 4 }, bottom: { ux: 28, uy: 16, w: 8, h: 4 } })} />}
          {visible.body && showOverlay && <Box w={8} h={12} d={4} faces={parts.bodyO} transform={`translate(${-4 * S}px, ${-12 * S}px) scale(${o})`} paintHandlers={boxPaint({ front: { ux: 20, uy: 36, w: 8, h: 12 }, back: { ux: 32, uy: 36, w: 8, h: 12 }, left: { ux: 28, uy: 36, w: 4, h: 12 }, right: { ux: 16, uy: 36, w: 4, h: 12 }, top: { ux: 20, uy: 32, w: 8, h: 4 }, bottom: { ux: 28, uy: 32, w: 8, h: 4 } })} />}
          {/* right arm */}
          {visible.rArm && <Box w={armW} h={12} d={4} faces={parts.rArm} transform={`translate(${(-4 - armW) * S}px, ${-12 * S}px)`} paintHandlers={boxPaint({ front: { ux: 44, uy: 20, w: 4, h: 12 }, back: { ux: 52, uy: 20, w: 4, h: 12 }, left: { ux: 48, uy: 20, w: 4, h: 12 }, right: { ux: 40, uy: 20, w: 4, h: 12 }, top: { ux: 44, uy: 16, w: 4, h: 4 }, bottom: { ux: 48, uy: 16, w: 4, h: 4 } })} />}
          {visible.rArm && showOverlay && <Box w={armW} h={12} d={4} faces={parts.rArmO} transform={`translate(${(-4 - armW) * S}px, ${-12 * S}px) scale(${o})`} paintHandlers={boxPaint({ front: { ux: 44, uy: 36, w: 4, h: 12 }, back: { ux: 52, uy: 36, w: 4, h: 12 }, left: { ux: 48, uy: 36, w: 4, h: 12 }, right: { ux: 40, uy: 36, w: 4, h: 12 }, top: { ux: 44, uy: 32, w: 4, h: 4 }, bottom: { ux: 48, uy: 32, w: 4, h: 4 } })} />}
          {/* left arm */}
          {visible.lArm && <Box w={armW} h={12} d={4} faces={parts.lArm} transform={`translate(${4 * S}px, ${-12 * S}px)`} paintHandlers={boxPaint({ front: { ux: 36, uy: 52, w: 4, h: 12 }, back: { ux: 44, uy: 52, w: 4, h: 12 }, left: { ux: 40, uy: 52, w: 4, h: 12 }, right: { ux: 32, uy: 52, w: 4, h: 12 }, top: { ux: 36, uy: 48, w: 4, h: 4 }, bottom: { ux: 40, uy: 48, w: 4, h: 4 } })} />}
          {visible.lArm && showOverlay && <Box w={armW} h={12} d={4} faces={parts.lArmO} transform={`translate(${4 * S}px, ${-12 * S}px) scale(${o})`} paintHandlers={boxPaint({ front: { ux: 52, uy: 52, w: 4, h: 12 }, back: { ux: 60, uy: 52, w: 4, h: 12 }, left: { ux: 56, uy: 52, w: 4, h: 12 }, right: { ux: 48, uy: 52, w: 4, h: 12 }, top: { ux: 52, uy: 48, w: 4, h: 4 }, bottom: { ux: 56, uy: 48, w: 4, h: 4 } })} />}
          {/* right leg */}
          {visible.rLeg && <Box w={4} h={12} d={4} faces={parts.rLeg} transform={`translate(${-4 * S}px, ${0 * S}px)`} paintHandlers={boxPaint({ front: { ux: 4, uy: 20, w: 4, h: 12 }, back: { ux: 12, uy: 20, w: 4, h: 12 }, left: { ux: 8, uy: 20, w: 4, h: 12 }, right: { ux: 0, uy: 20, w: 4, h: 12 }, top: { ux: 4, uy: 16, w: 4, h: 4 }, bottom: { ux: 8, uy: 16, w: 4, h: 4 } })} />}
          {visible.rLeg && showOverlay && <Box w={4} h={12} d={4} faces={parts.rLegO} transform={`translate(${-4 * S}px, ${0 * S}px) scale(${o})`} paintHandlers={boxPaint({ front: { ux: 4, uy: 36, w: 4, h: 12 }, back: { ux: 12, uy: 36, w: 4, h: 12 }, left: { ux: 8, uy: 36, w: 4, h: 12 }, right: { ux: 0, uy: 36, w: 4, h: 12 }, top: { ux: 4, uy: 32, w: 4, h: 4 }, bottom: { ux: 8, uy: 32, w: 4, h: 4 } })} />}
          {/* left leg */}
          {visible.lLeg && <Box w={4} h={12} d={4} faces={parts.lLeg} transform={`translate(${0 * S}px, ${0 * S}px)`} paintHandlers={boxPaint({ front: { ux: 20, uy: 52, w: 4, h: 12 }, back: { ux: 28, uy: 52, w: 4, h: 12 }, left: { ux: 24, uy: 52, w: 4, h: 12 }, right: { ux: 16, uy: 52, w: 4, h: 12 }, top: { ux: 20, uy: 48, w: 4, h: 4 }, bottom: { ux: 24, uy: 48, w: 4, h: 4 } })} />}
          {visible.lLeg && showOverlay && <Box w={4} h={12} d={4} faces={parts.lLegO} transform={`translate(${0 * S}px, ${0 * S}px) scale(${o})`} paintHandlers={boxPaint({ front: { ux: 4, uy: 52, w: 4, h: 12 }, back: { ux: 12, uy: 52, w: 4, h: 12 }, left: { ux: 8, uy: 52, w: 4, h: 12 }, right: { ux: 0, uy: 52, w: 4, h: 12 }, top: { ux: 4, uy: 48, w: 4, h: 4 }, bottom: { ux: 8, uy: 48, w: 4, h: 4 } })} />}
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
