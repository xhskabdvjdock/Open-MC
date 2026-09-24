"use client";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Download, FileUp } from "lucide-react";
import { useApp } from "@/components/Providers";
import { parseNbt, nbtToJson, countNbtNodes } from "@/lib/nbt";
import { downloadBlob } from "@/lib/pixel-utils";
import { Btn, Tabs, Panel } from "@/components/ui";

export default function JsonPage() {
  return (
    <Suspense>
      <JsonInner />
    </Suspense>
  );
}

function JsonInner() {
  const { notify } = useApp();
  const search = useSearchParams();
  const [tab, setTab] = useState<"json" | "nbt">(search.get("tab") === "nbt" ? "nbt" : "json");
  const [text, setText] = useState('{\n  "pack": {\n    "pack_format": 48,\n    "description": "My pack"\n  }\n}');
  const [error, setError] = useState("");
  const [nbtJson, setNbtJson] = useState<unknown>(null);
  const [nbtMeta, setNbtMeta] = useState("");
  const [nbtBusy, setNbtBusy] = useState(false);

  const charCount = useMemo(() => text.length, [text]);

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
      <Tabs
        ariaLabel="Tool"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "json", label: "JSON formatter / validator" },
          { id: "nbt", label: "NBT viewer" },
        ]}
      />

      {tab === "json" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Btn onClick={format}>Format</Btn>
            <Btn onClick={minify}>Minify</Btn>
            <Btn onClick={validate}>Validate</Btn>
            <Btn onClick={copy}><Copy className="size-3.5" aria-hidden /> Copy</Btn>
            <Btn onClick={download}><Download className="size-3.5" aria-hidden /> Download</Btn>
            <span className="ms-auto font-mono text-[11.5px]" style={{ color: "var(--faint)" }} aria-live="polite">
              {error ? <span style={{ color: "var(--danger)" }}>invalid</span> : <span style={{ color: "var(--accent)" }}>valid</span>} · {charCount} chars
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            rows={22}
            spellCheck={false}
            aria-label="JSON input"
            className="w-full rounded border p-2.5 font-mono text-[12.5px] outline-none"
            style={{ borderColor: error ? "var(--danger)" : "var(--border)", background: "var(--panel)" }}
          />
          {error && (
            <p role="alert" className="rounded border px-2.5 py-2 font-mono text-[12.5px]" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</p>
          )}
        </div>
      )}

      {tab === "nbt" && (
        <Panel title="NBT viewer">
          <p className="mb-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
            Reads uncompressed and gzip-compressed single-tag NBT (<span className="font-mono">level.dat</span>, <span className="font-mono">.nbt</span>, <span className="font-mono">.dat</span>).
            Region files (<span className="font-mono">.mca</span>) are not supported and will be refused. Everything runs locally.
          </p>
          <label className="ui-transition flex cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed px-3 py-5 text-[13px] font-semibold" style={{ borderColor: "var(--border-strong)" }}>
            <FileUp className="size-4" aria-hidden style={{ color: "var(--muted)" }} /> {nbtBusy ? "Parsing…" : "Choose an NBT file…"}
            <input type="file" accept=".dat,.nbt,.bin" className="hidden" onChange={onNbtFile} />
          </label>
          {nbtMeta && <p className="mt-2 font-mono text-[12px]" style={{ color: "var(--muted)" }}>{nbtMeta}</p>}
          {nbtJson !== null && (
            <div className="mt-2">
              <div className="max-h-[480px] overflow-y-auto rounded border p-2" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}>
                <NbtTree tag={nbtJson} name="(root)" depth={0} />
              </div>
              <div className="mt-2">
                <Btn primary onClick={() => { downloadBlob(new Blob([nbtText], { type: "application/json" }), "nbt.json"); notify("Downloaded"); }}>
                  <Download className="size-4" aria-hidden /> Download as JSON
                </Btn>
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function NbtTree({ tag, name, depth }: { tag: unknown; name: string; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (tag === null || typeof tag !== "object") {
    return (
      <div className="flex gap-2 py-px font-mono text-[12.5px]" style={{ marginInlineStart: depth * 14 }}>
        <span style={{ color: "var(--muted)" }}>{name}:</span>
        <span style={{ color: "var(--accent)" }}>{String(tag)}</span>
      </div>
    );
  }
  const entries = Object.entries(tag as Record<string, unknown>);
  if (Array.isArray(tag)) {
    return (
      <div style={{ marginInlineStart: depth * 14 }} className="py-px">
        <button onClick={() => setOpen(!open)} className="font-mono text-[12.5px]" style={{ color: "var(--muted)" }} aria-expanded={open}>
          {open ? "−" : "+"} {name} [{tag.length}]
        </button>
        {open && tag.slice(0, 200).map((v, i) => <NbtTree key={i} tag={v} name={`${i}`} depth={depth + 1} />)}
        {open && tag.length > 200 && <p className="font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>…{tag.length - 200} more items hidden for performance</p>}
      </div>
    );
  }
  return (
    <div style={{ marginInlineStart: depth * 14 }} className="py-px">
      <button onClick={() => setOpen(!open)} className="font-mono text-[12.5px]" aria-expanded={open}>
        <span style={{ color: "var(--muted)" }}>{open ? "−" : "+"} {name}</span> <span style={{ color: "var(--faint)" }}>{"{"}{entries.length}{"}"}</span>
      </button>
      {open && entries.slice(0, 200).map(([k, v]) => <NbtTree key={k} tag={v} name={k} depth={depth + 1} />)}
      {open && entries.length > 200 && <p className="font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>…{entries.length - 200} more keys hidden</p>}
    </div>
  );
}
