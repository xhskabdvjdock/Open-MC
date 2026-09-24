"use client";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Pencil, Eraser, Pipette, PaintBucket, Minus, Square, Grid3x3, Undo2, Redo2, ZoomIn, ZoomOut } from "lucide-react";

export type PixelTool = "pencil" | "eraser" | "eyedropper" | "fill" | "line" | "rect";

export interface PixelEditorHandle {
  getCanvas: () => HTMLCanvasElement | null;
  getBlob: () => Promise<Blob | null>;
  setImage: (img: HTMLImageElement | HTMLCanvasElement) => void;
  clearHistory: () => void;
}

interface Props {
  width: number;
  height: number;
  initialImage?: HTMLImageElement | HTMLCanvasElement | null;
  onEdit?: () => void;
  showGridDefault?: boolean;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

function clonePixels(ctx: CanvasRenderingContext2D, w: number, h: number): ImageData {
  return ctx.getImageData(0, 0, w, h);
}

function floodFill(data: ImageData, sx: number, sy: number, fill: [number, number, number, number]): void {
  const { width, height } = data;
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return;
  const px = data.data;
  const si = (sy * width + sx) * 4;
  const tr = px[si], tg = px[si + 1], tb = px[si + 2], ta = px[si + 3];
  if (tr === fill[0] && tg === fill[1] && tb === fill[2] && ta === fill[3]) return;
  const stack: [number, number][] = [[sx, sy]];
  const seen = new Uint8Array(width * height);
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (seen[idx]) continue;
    const i = idx * 4;
    if (px[i] !== tr || px[i + 1] !== tg || px[i + 2] !== tb || px[i + 3] !== ta) continue;
    seen[idx] = 1;
    px[i] = fill[0]; px[i + 1] = fill[1]; px[i + 2] = fill[2]; px[i + 3] = fill[3];
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    if (stack.length > width * height * 2) break; // safety
  }
}

function drawLinePixels(data: ImageData, x0: number, y0: number, x1: number, y1: number, rgba: [number, number, number, number] | null): void {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  const put = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= data.width || py >= data.height) return;
    const i = (py * data.width + px) * 4;
    if (rgba === null) { data.data[i + 3] = 0; }
    else { data.data[i] = rgba[0]; data.data[i + 1] = rgba[1]; data.data[i + 2] = rgba[2]; data.data[i + 3] = rgba[3]; }
  };
  for (;;) {
    put(x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function hexToRgbaLocal(hex: string): [number, number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 6) h += "ff";
  const n = parseInt(h, 16);
  return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const PixelEditor = React.forwardRef<PixelEditorHandle, Props>(function PixelEditor(
  { width, height, initialImage, onEdit, showGridDefault = true, onZoomChange }: Props,
  ref
) {
  const dataRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<PixelTool>("pencil");
  const [color, setColor] = useState("#00c853");
  const [zoom, setZoom] = useState(8);
  const [grid, setGrid] = useState(showGridDefault);
  const [fillShapes, setFillShapes] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => { onZoomChange?.(zoom); }, [zoom, onZoomChange]);
  const history = useRef<ImageData[]>([]);
  const hIndex = useRef(-1);
  const drawing = useRef(false);
  const startPt = useRef<[number, number] | null>(null);
  const snapshot = useRef<ImageData | null>(null);

  const render = useCallback(() => {
    const src = dataRef.current;
    const view = viewRef.current;
    if (!src || !view) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssW = width * zoom;
    const cssH = height * zoom;
    // backing store sized for DPR so retina stays razor-sharp
    view.width = Math.round(cssW * dpr);
    view.height = Math.round(cssH * dpr);
    view.style.width = `${cssW}px`;
    view.style.height = `${cssH}px`;
    const vctx = view.getContext("2d")!;
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vctx.imageSmoothingEnabled = false;
    // checkerboard for transparency — drawn at CSS pixels so pattern stays consistent
    vctx.fillStyle = "#ffffff";
    vctx.fillRect(0, 0, cssW, cssH);
    vctx.fillStyle = "#d4d4d4";
    const cell = Math.max(zoom / 2, 4);
    for (let y = 0; y < cssH; y += cell * 2) {
      for (let x = 0; x < cssW; x += cell * 2) {
        vctx.fillRect(x, y, cell, cell);
        vctx.fillRect(x + cell, y + cell, cell, cell);
      }
    }
    // true pixel — nearest-neighbor only, true colors, alpha kept
    vctx.drawImage(src, 0, 0, cssW, cssH);
    if (grid && zoom >= 4) {
      vctx.strokeStyle = "rgba(0,0,0,0.22)";
      vctx.lineWidth = 1;
      vctx.beginPath();
      for (let x = 0; x <= width; x++) {
        vctx.moveTo(x * zoom + 0.5, 0);
        vctx.lineTo(x * zoom + 0.5, cssH);
      }
      for (let y = 0; y <= height; y++) {
        vctx.moveTo(0, y * zoom + 0.5);
        vctx.lineTo(cssW, y * zoom + 0.5);
      }
      vctx.stroke();
    }
  }, [width, height, zoom, grid]);

  const pushHistory = useCallback(() => {
    const c = dataRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const snap = clonePixels(ctx, width, height);
    history.current = history.current.slice(0, hIndex.current + 1);
    history.current.push(snap);
    if (history.current.length > 60) history.current.shift();
    hIndex.current = history.current.length - 1;
    setCanUndo(hIndex.current > 0);
    setCanRedo(false);
  }, [width, height]);

  const restore = useCallback((idx: number) => {
    const c = dataRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.putImageData(history.current[idx], 0, 0);
    hIndex.current = idx;
    setCanUndo(idx > 0);
    setCanRedo(idx < history.current.length - 1);
    render();
    onEdit?.();
  }, [render, onEdit]);

  const undo = useCallback(() => {
    if (hIndex.current > 0) restore(hIndex.current - 1);
  }, [restore]);

  const redo = useCallback(() => {
    if (hIndex.current < history.current.length - 1) restore(hIndex.current + 1);
  }, [restore]);

  // init backing canvas
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    if (initialImage) {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(initialImage as CanvasImageSource, 0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    dataRef.current = c;
    history.current = [];
    hIndex.current = -1;
    pushHistory();
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // reload when initialImage changes identity (e.g. file opened)
  useEffect(() => {
    if (!initialImage || !dataRef.current) { render(); return; }
    const ctx = dataRef.current.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(initialImage as CanvasImageSource, 0, 0, width, height);
    pushHistory();
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImage]);

  useEffect(() => { render(); }, [render]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useImperativeHandle(ref, () => ({
    getCanvas: () => dataRef.current,
    getBlob: () => new Promise<Blob | null>((res) => dataRef.current?.toBlob((b) => res(b), "image/png")),
    setImage: (img) => {
      const c = dataRef.current;
      if (!c) return;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img as CanvasImageSource, 0, 0, width, height);
      pushHistory();
      render();
    },
    clearHistory: () => { history.current = []; hIndex.current = -1; pushHistory(); },
  }));

  const posFromEvent = (e: React.PointerEvent): [number, number] => {
    const view = viewRef.current!;
    const r = view.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * height);
    return [x, y];
  };

  const commit = () => { pushHistory(); render(); onEdit?.(); };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const c = dataRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const [x, y] = posFromEvent(e);
    if (tool === "eyedropper") {
      const d = ctx.getImageData(Math.max(0, Math.min(width - 1, x)), Math.max(0, Math.min(height - 1, y)), 1, 1).data;
      if (d[3] > 0) {
        setColor("#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
      }
      return;
    }
    if (tool === "fill") {
      const img = ctx.getImageData(0, 0, width, height);
      floodFill(img, x, y, hexToRgbaLocal(color));
      ctx.putImageData(img, 0, 0);
      commit();
      return;
    }
    drawing.current = true;
    startPt.current = [x, y];
    snapshot.current = clonePixels(ctx, width, height);
    if (tool === "pencil" || tool === "eraser") {
      const i = (y * width + x) * 4;
      if (x >= 0 && y >= 0 && x < width && y < height) {
        const img = ctx.getImageData(0, 0, width, height);
        if (tool === "eraser") { img.data[i + 3] = 0; }
        else {
          const [r, g, b, a] = hexToRgbaLocal(color);
          img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
        }
        ctx.putImageData(img, 0, 0);
        render();
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = dataRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const [x, y] = posFromEvent(e);
    const [sx, sy] = startPt.current ?? [x, y];
    if (tool === "pencil" || tool === "eraser") {
      const img = ctx.getImageData(0, 0, width, height);
      drawLinePixels(img, sx, sy, x, y, tool === "eraser" ? null : hexToRgbaLocal(color));
      ctx.putImageData(img, 0, 0);
      startPt.current = [x, y];
      render();
    } else if (tool === "line" || tool === "rect") {
      // preview from snapshot
      ctx.putImageData(snapshot.current!, 0, 0);
      const img = ctx.getImageData(0, 0, width, height);
      const rgba = hexToRgbaLocal(color);
      if (tool === "line") {
        drawLinePixels(img, startPt.current![0], startPt.current![1], x, y, rgba);
      } else {
        const x0 = Math.min(sx, x), x1 = Math.max(sx, x);
        const y0 = Math.min(sy, y), y1 = Math.max(sy, y);
        if (fillShapes) {
          for (let py = y0; py <= y1; py++)
            for (let px = x0; px <= x1; px++) {
              if (px < 0 || py < 0 || px >= width || py >= height) continue;
              const i = (py * width + px) * 4;
              img.data[i] = rgba[0]; img.data[i + 1] = rgba[1]; img.data[i + 2] = rgba[2]; img.data[i + 3] = rgba[3];
            }
        } else {
          drawLinePixels(img, x0, y0, x1, y0, rgba);
          drawLinePixels(img, x1, y0, x1, y1, rgba);
          drawLinePixels(img, x1, y1, x0, y1, rgba);
          drawLinePixels(img, x0, y1, x0, y0, rgba);
        }
      }
      ctx.putImageData(img, 0, 0);
      render();
    }
  };

  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    snapshot.current = null;
    commit();
  };

  const tools: { id: PixelTool; Icon: React.ElementType; label: string }[] = [
    { id: "pencil", Icon: Pencil, label: "Pencil (B)" },
    { id: "eraser", Icon: Eraser, label: "Eraser (E)" },
    { id: "eyedropper", Icon: Pipette, label: "Eyedropper (I)" },
    { id: "fill", Icon: PaintBucket, label: "Fill (G)" },
    { id: "line", Icon: Minus, label: "Line (L)" },
    { id: "rect", Icon: Square, label: "Rectangle (R)" },
  ];

  const toolBtn = (pressed: boolean): React.CSSProperties => ({
    background: pressed ? "var(--accent)" : "transparent",
    color: pressed ? "#fff" : "var(--muted)",
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-0.5 rounded border p-1"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        role="toolbar"
        aria-label="Pixel tools"
      >
        {tools.map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            className="ui-transition rounded p-2"
            style={toolBtn(tool === id)}
            onMouseEnter={(e) => { if (tool !== id) (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)"; }}
            onMouseLeave={(e) => { if (tool !== id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        ))}
        <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} aria-hidden />
        <input
          type="color"
          value={color.length === 7 ? color : color.slice(0, 7)}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Color picker"
          title="Color picker"
          className="h-8 w-9 cursor-pointer rounded border bg-transparent"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Hex color"
          spellCheck={false}
          className="w-20 rounded border px-1.5 py-1 font-mono text-[12px]"
          style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        />
        <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} aria-hidden />
        <button onClick={undo} disabled={!canUndo} aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" className="ui-transition rounded p-2 disabled:opacity-35" style={{ color: "var(--muted)" }}>
          <Undo2 className="size-4" aria-hidden />
        </button>
        <button onClick={redo} disabled={!canRedo} aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" className="ui-transition rounded p-2 disabled:opacity-35" style={{ color: "var(--muted)" }}>
          <Redo2 className="size-4" aria-hidden />
        </button>
        <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} aria-hidden />
        <button onClick={() => setZoom((z) => Math.max(1, z - 1))} aria-label="Zoom out" title="Zoom out" className="ui-transition rounded p-2" style={{ color: "var(--muted)" }}>
          <ZoomOut className="size-4" aria-hidden />
        </button>
        <span className="min-w-12 text-center font-mono text-[12px]" style={{ color: "var(--muted)" }} aria-live="polite">{zoom * 100}%</span>
        <button onClick={() => setZoom((z) => Math.min(32, z + 1))} aria-label="Zoom in" title="Zoom in" className="ui-transition rounded p-2" style={{ color: "var(--muted)" }}>
          <ZoomIn className="size-4" aria-hidden />
        </button>
        <button
          onClick={() => setGrid((g) => !g)}
          aria-label="Toggle grid"
          aria-pressed={grid}
          title="Toggle grid"
          className="ui-transition rounded p-2"
          style={toolBtn(grid)}
        >
          <Grid3x3 className="size-4" aria-hidden />
        </button>
        {(tool === "rect") && (
          <label className="ms-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--muted)" }}>
            <input type="checkbox" checked={fillShapes} onChange={(e) => setFillShapes(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
            Fill
          </label>
        )}
      </div>
      <div className="checker overflow-auto rounded border p-3" style={{ borderColor: "var(--border)" }}>
        <canvas
          ref={viewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="pixel mx-auto block max-w-none cursor-crosshair touch-none rounded-sm"
          style={{ boxShadow: "var(--shadow-pop)" }}
          role="application"
          aria-label={`Pixel canvas ${width} by ${height}`}
        />
        <p className="mt-2 text-center font-mono text-[11px]" style={{ color: "var(--faint)" }}>
          {width}×{height} px · no smoothing · alpha preserved
        </p>
      </div>
    </div>
  );
});
