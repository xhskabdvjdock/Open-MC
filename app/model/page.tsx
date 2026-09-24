"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Upload, Wand2, Save } from "lucide-react";
import { useApp } from "@/components/Providers";
import { ModelPreview, type McModel } from "@/components/ModelPreview";
import { downloadBlob } from "@/lib/pixel-utils";
import { Btn } from "@/components/ui";
import { consumeNewProject } from "@/components/NewProjectDialog";

const BLANK_MODEL: McModel = {
  textures: { particle: "minecraft:block/stone", all: "minecraft:block/stone" },
  elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { down: { texture: "#all" }, up: { texture: "#all" }, north: { texture: "#all" }, south: { texture: "#all" }, west: { texture: "#all" }, east: { texture: "#all" } } }],
};

export default function ModelPage() {
  const { notify, setProject } = useApp();
  const [text, setText] = useState(JSON.stringify(BLANK_MODEL, null, 2));
  const [error, setError] = useState("");
  const [name, setName] = useState("model.json");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    try {
      const seed = consumeNewProject("model");
      if (seed) { setName(`${seed.replace(/\s+/g, "-")}.json`); setDirty(true); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setProject({ name, kind: "Model", dirty });
  }, [name, dirty, setProject]);
  useEffect(() => () => setProject(null), [setProject]);

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
      JSON.parse(t);
      setText(JSON.stringify(JSON.parse(t), null, 2));
      setError("");
      setName(f.name);
      setDirty(true);
      notify("Model imported");
    } catch {
      notify("That file is not valid JSON.", "err");
    }
  }, [notify]);

  const exportJson = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      downloadBlob(new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" }), name || "model.json");
      setDirty(false);
      notify("Exported");
    } catch {
      notify("Cannot export invalid JSON. Fix errors first.", "err");
    }
  }, [text, name, notify]);

  const save = useCallback(() => {
    try { JSON.parse(text); setDirty(false); notify("Validated — no export needed"); }
    catch { notify("Invalid JSON — fix errors first.", "err"); }
  }, [text, notify]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (!(e.ctrlKey || e.metaKey) || typing) return;
      if (e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
      if (e.key.toLowerCase() === "e") { e.preventDefault(); exportJson(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, exportJson]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          aria-label="File name"
          spellCheck={false}
          className="w-48 rounded border border-transparent bg-transparent px-2 py-1 text-[14px] font-bold outline-none"
          onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border)")}
          onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "transparent")}
        />
        <span className="flex items-center gap-1.5 font-mono text-[11.5px]" style={{ color: "var(--muted)" }} role="status">
          <span className="inline-block size-2 rounded-full" style={{ background: dirty ? "var(--warn)" : "var(--accent)" }} />
          {dirty ? "Unsaved changes" : "Saved locally"}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          <label className="ui-transition flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-[13px] font-semibold" style={{ borderColor: "var(--border)" }} title="Import JSON (Ctrl+O)">
            <Upload className="size-4" aria-hidden /> Import
            <input type="file" accept="application/json,.json" className="hidden" onChange={importFile} />
          </label>
          <Btn onClick={save} title="Validate (Ctrl+S)">
            <Save className="size-4" aria-hidden /> Save
          </Btn>
          <Btn primary onClick={exportJson} title="Export JSON (Ctrl+E)">
            <Download className="size-4" aria-hidden /> Export
          </Btn>
        </span>
      </div>

      <div className="grid min-h-[520px] flex-1 gap-0 lg:grid-cols-2" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
        <section className="flex min-w-0 flex-col border-b p-3 lg:border-b-0 lg:border-e" style={{ borderColor: "var(--border)" }} aria-label="JSON editor">
          <div className="mb-1.5 flex items-center gap-1.5">
            <button onClick={format} className="ui-transition flex items-center gap-1 rounded border px-2 py-1 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>
              <Wand2 className="size-3.5" aria-hidden /> Format
            </button>
            <button onClick={() => { setText(JSON.stringify(BLANK_MODEL, null, 2)); setError(""); setDirty(true); }} className="ui-transition rounded border px-2 py-1 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>
              Blank cube
            </button>
            <span className="ms-auto font-mono text-[11.5px]" style={{ color: error ? "var(--danger)" : issues.length === 0 ? "var(--accent)" : "var(--warn)" }}>
              {error ? "syntax error" : issues.length === 0 ? "valid" : `${issues.length} issue(s)`}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); setDirty(true); }}
            rows={22}
            spellCheck={false}
            aria-label="Model JSON"
            className="w-full flex-1 rounded border p-2 font-mono text-[12px] outline-none"
            style={{ borderColor: error ? "var(--danger)" : "var(--border)", background: "var(--panel-2)" }}
          />
          {error && <p className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }} role="alert">{error}</p>}
          <div className="mt-2 rounded border p-2 text-[12.5px]" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }} aria-live="polite">
            <p className="font-bold">Diagnostics</p>
            {issues.length === 0 ? (
              <p className="mt-0.5" style={{ color: "var(--accent)" }}>Valid model JSON.</p>
            ) : (
              <ul className="mt-0.5 list-inside list-disc" style={{ color: "var(--warn)" }}>
                {issues.map((i, k) => <li key={k}>{i}</li>)}
              </ul>
            )}
          </div>
        </section>
        <section className="flex min-w-0 flex-col p-3" style={{ background: "var(--bg)" }} aria-label="3D preview">
          <ModelPreview model={model} />
          {!model && <p className="mt-2 text-center text-[12.5px]" style={{ color: "var(--danger)" }}>Invalid JSON — fix syntax to preview.</p>}
        </section>
      </div>
    </div>
  );
}
