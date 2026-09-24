"use client";
import { useCallback, useMemo, useState } from "react";
import { Box, Download, Upload, Wand2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { ModelPreview, type McModel } from "@/components/ModelPreview";
import { downloadBlob } from "@/lib/pixel-utils";

const BLANK_MODEL: McModel = {
  textures: { particle: "minecraft:block/stone", all: "minecraft:block/stone" },
  elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { down: { texture: "#all" }, up: { texture: "#all" }, north: { texture: "#all" }, south: { texture: "#all" }, west: { texture: "#all" }, east: { texture: "#all" } } }],
};

export default function ModelPage() {
  const { notify } = useApp();
  const [text, setText] = useState(JSON.stringify(BLANK_MODEL, null, 2));
  const [error, setError] = useState("");
  const [name, setName] = useState("model.json");

  const model: McModel | null = useMemo(() => {
    try { return JSON.parse(text); } catch { return null; }
  }, [text]);

  const issues = useMemo(() => {
    const out: string[] = [];
    if (!model) return ["Invalid JSON."];
    if (model.parent && typeof model.parent !== "string") out.push('"parent" must be a string.');
    if (model.textures && typeof model.textures !== "object") out.push('"textures" must be an object.');
    if (model.elements) {
      if (!Array.isArray(model.elements)) out.push('"elements" must be an array.');
      else model.elements.forEach((el, i) => {
        if (el.from && (!Array.isArray(el.from) || el.from.length !== 3)) out.push(`elements[${i}].from must be [x,y,z].`);
        if (el.to && (!Array.isArray(el.to) || el.to.length !== 3)) out.push(`elements[${i}].to must be [x,y,z].`);
        const f = el.from ?? [0, 0, 0], t = el.to ?? [16, 16, 16];
        for (let k = 0; k < 3; k++) {
          if (t[k] - f[k] <= 0) { out.push(`elements[${i}] has zero/negative size on axis ${k}.`); break; }
          if (f[k] < -16 || t[k] > 32) { out.push(`elements[${i}] is outside the -16…32 range.`); break; }
        }
      });
    }
    return out;
  }, [model]);

  const format = useCallback(() => {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setError("");
      notify("Formatted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      notify("Invalid JSON.", "err");
    }
  }, [text, notify]);

  const importFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const t = await f.text();
      JSON.parse(t); // validate before accepting
      setText(JSON.stringify(JSON.parse(t), null, 2));
      setError("");
      setName(f.name);
      notify("Model imported");
    } catch {
      notify("That file is not valid JSON.", "err");
    }
  }, [notify]);

  const exportJson = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      downloadBlob(new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" }), name || "model.json");
      notify("Exported");
    } catch {
      notify("Cannot export invalid JSON. Fix errors first.", "err");
    }
  }, [text, name, notify]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><Box className="size-5 text-emerald-600" aria-hidden /> Model Studio</h1>
        <span className="ms-auto flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] hover:border-emerald-500 dark:border-slate-700">
            <Upload className="size-4" aria-hidden /> Import JSON
            <input type="file" accept="application/json,.json" className="hidden" onChange={importFile} />
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="File name" className="w-40 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] dark:border-slate-700 dark:bg-slate-900" />
          <button onClick={exportJson} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
            <Download className="size-4" aria-hidden /> Export JSON
          </button>
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-1.5 flex items-center gap-2">
            <h2 className="text-[13px] font-bold">JSON editor</h2>
            <button onClick={format} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[12px] hover:border-emerald-500 dark:border-slate-700">
              <Wand2 className="size-3.5" aria-hidden /> Format
            </button>
            <button onClick={() => { setText(JSON.stringify(BLANK_MODEL, null, 2)); setError(""); }} className="rounded border border-slate-200 px-2 py-0.5 text-[12px] hover:border-emerald-500 dark:border-slate-700">
              Blank cube
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            rows={24}
            spellCheck={false}
            aria-label="Model JSON"
            className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12px] dark:border-slate-700 dark:bg-slate-950"
          />
          {error && <p className="mt-1 text-[12px] text-red-600" role="alert">{error}</p>}
          <div className="mt-2 rounded-md border border-slate-200 p-2 text-[12.5px] dark:border-slate-700" aria-live="polite">
            <p className="font-bold">Validation</p>
            {issues.length === 0 ? (
              <p className="text-emerald-600">Valid model JSON.</p>
            ) : (
              <ul className="list-inside list-disc text-amber-700 dark:text-amber-300">
                {issues.map((i, k) => <li key={k}>{i}</li>)}
              </ul>
            )}
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1.5 text-[13px] font-bold">3D preview</h2>
          <ModelPreview model={model} />
        </section>
      </div>
    </div>
  );
}
