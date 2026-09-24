"use client";
import { useCallback, useMemo, useState } from "react";
import { Braces, Database, Download, Copy, FileUp } from "lucide-react";
import { useApp } from "@/components/Providers";
import { parseNbt, nbtToJson, countNbtNodes, type NbtTag } from "@/lib/nbt";
import { downloadBlob } from "@/lib/pixel-utils";

export default function JsonPage() {
  const { notify } = useApp();
  const [tab, setTab] = useState<"json" | "nbt">("json");
  const [text, setText] = useState('{\n  "pack": {\n    "pack_format": 48,\n    "description": "My pack"\n  }\n}');
  const [error, setError] = useState("");
  const [nbtJson, setNbtJson] = useState<unknown>(null);
  const [nbtMeta, setNbtMeta] = useState("");
  const [nbtBusy, setNbtBusy] = useState(false);

  const validate = useCallback(() => {
    try {
      JSON.parse(text);
      setError("");
      notify("Valid JSON");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid JSON";
      setError(msg);
      notify("Invalid JSON.", "err");
    }
  }, [text, notify]);

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

  const minify = useCallback(() => {
    try {
      setText(JSON.stringify(JSON.parse(text)));
      setError("");
      notify("Minified");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      notify("Invalid JSON.", "err");
    }
  }, [text, notify]);

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(text); notify("Copied"); }
    catch { notify("Copy failed.", "err"); }
  }, [text, notify]);

  const download = useCallback(() => {
    try {
      JSON.parse(text);
      downloadBlob(new Blob([text], { type: "application/json" }), "data.json");
      notify("Downloaded");
    } catch {
      notify("Cannot download invalid JSON. Validate first.", "err");
    }
  }, [text, notify]);

  const onNbtFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.mca$/i.test(f.name)) {
      setNbtMeta("");
      setNbtJson(null);
      notify("Region files (.mca) are not supported — only single-tag NBT (.dat, .nbt).", "err");
      return;
    }
    setNbtBusy(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const root = await parseNbt(bytes);
      setNbtJson(nbtToJson(root.root));
      setNbtMeta(`${f.name} · root "${root.name || "(unnamed)"}" · ${root.compressed ? "gzip-compressed" : "uncompressed"} · ${countNbtNodes(root.root)} nodes · ${bytes.length} bytes`);
      notify("NBT parsed");
    } catch (err) {
      setNbtJson(null);
      setNbtMeta("");
      notify(err instanceof Error ? err.message : "Could not parse NBT.", "err");
    } finally {
      setNbtBusy(false);
    }
  }, [notify]);

  const nbtText = useMemo(() => (nbtJson === null ? "" : JSON.stringify(nbtJson, null, 2)), [nbtJson]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><Braces className="size-5 text-emerald-600" aria-hidden /> JSON / NBT Tools</h1>
      <div className="flex gap-1.5" role="tablist" aria-label="Tool">
        {(["json", "nbt"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded-md border px-3 py-1.5 font-mono text-[13px] ${tab === v ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 hover:border-emerald-500 dark:border-slate-700"}`}>
            {v === "json" ? "JSON" : "NBT"}
          </button>
        ))}
      </div>

      {tab === "json" && (
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" aria-label="JSON editor">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Op onClick={format}>Format</Op>
            <Op onClick={minify}>Minify</Op>
            <Op onClick={validate}>Validate</Op>
            <Op onClick={copy}><Copy className="size-3.5" aria-hidden /> Copy</Op>
            <Op onClick={download}><Download className="size-3.5" aria-hidden /> Download</Op>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            rows={20}
            spellCheck={false}
            aria-label="JSON input"
            className="w-full rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[12.5px] dark:border-slate-700 dark:bg-slate-950"
          />
          {error ? (
            <p role="alert" className="mt-2 rounded-md border border-red-500/40 bg-red-50 px-2.5 py-2 font-mono text-[12.5px] text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>
          ) : (
            <p className="mt-2 text-[12.5px] text-emerald-600" aria-live="polite">Valid JSON — {text.length} characters.</p>
          )}
        </section>
      )}

      {tab === "nbt" && (
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900" aria-label="NBT viewer">
          <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold"><Database className="size-4" aria-hidden /> NBT viewer</h2>
          <p className="mb-2 text-[12.5px] text-slate-500">Reads uncompressed and gzip-compressed single-tag NBT (<code>level.dat</code>, <code>.nbt</code>, <code>.dat</code>). Region files (<code>.mca</code>) are not supported and will be refused honestly. Everything runs locally.</p>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-5 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700">
            <FileUp className="size-4" aria-hidden /> {nbtBusy ? "Parsing…" : "Choose an NBT file…"}
            <input type="file" accept=".dat,.nbt,.bin" className="hidden" onChange={onNbtFile} />
          </label>
          {nbtMeta && <p className="mt-2 font-mono text-[12px] text-slate-600 dark:text-slate-300">{nbtMeta}</p>}
          {nbtJson !== null && (
            <div className="mt-2">
              <NbtTree tag={nbtJson} name="(root)" depth={0} />
              <button
                onClick={() => { downloadBlob(new Blob([nbtText], { type: "application/json" }), "nbt.json"); notify("Downloaded"); }}
                className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
              >
                <Download className="size-4" aria-hidden /> Download as JSON
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Op({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700">
      {children}
    </button>
  );
}

function NbtTree({ tag, name, depth }: { tag: unknown; name: string; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (tag === null || typeof tag !== "object") {
    return (
      <div className="flex gap-2 py-0.5 font-mono text-[12.5px]" style={{ marginInlineStart: depth * 14 }}>
        <span className="text-slate-500">{name}:</span>
        <span className="text-emerald-700 dark:text-emerald-300">{String(tag)}</span>
      </div>
    );
  }
  const entries = Object.entries(tag as Record<string, unknown>);
  if (Array.isArray(tag)) {
    return (
      <div style={{ marginInlineStart: depth * 14 }} className="py-0.5">
        <button onClick={() => setOpen(!open)} className="font-mono text-[12.5px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" aria-expanded={open}>
          {open ? "−" : "+"} {name} [{tag.length}]
        </button>
        {open && tag.slice(0, 200).map((v, i) => <NbtTree key={i} tag={v} name={`${i}`} depth={depth + 1} />)}
        {open && tag.length > 200 && <p className="font-mono text-[11.5px] text-slate-400">…{tag.length - 200} more items hidden for performance</p>}
      </div>
    );
  }
  return (
    <div style={{ marginInlineStart: depth * 14 }} className="py-0.5">
      <button onClick={() => setOpen(!open)} className="font-mono text-[12.5px] hover:text-slate-900 dark:hover:text-slate-100" aria-expanded={open}>
        <span className="text-slate-500">{open ? "−" : "+"} {name}</span> <span className="text-slate-400">{"{"}{entries.length}{"}"}</span>
      </button>
      {open && entries.slice(0, 200).map(([k, v]) => <NbtTree key={k} tag={v} name={k} depth={depth + 1} />)}
      {open && entries.length > 200 && <p className="font-mono text-[11.5px] text-slate-400">…{entries.length - 200} more keys hidden</p>}
    </div>
  );
}

void (0 as unknown as NbtTag | null);
