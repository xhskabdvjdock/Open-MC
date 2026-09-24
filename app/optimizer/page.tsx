"use client";
import { useCallback, useState } from "react";
import JSZip from "jszip";
import { Gauge, Download, Trash2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { loadZipSafely } from "@/lib/zip-safety";
import { analyzePack, type OptimizeResult } from "@/lib/optimize-pack";
import { formatBytes, downloadBlob } from "@/lib/pixel-utils";

export default function OptimizerPage() {
  const { notify } = useApp();
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [raw, setRaw] = useState<{ path: string; bytes: Uint8Array }[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);

  const run = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    setBusy(true);
    try {
      const { entries } = await loadZipSafely(f);
      const list: { path: string; bytes: Uint8Array }[] = [];
      for (const e of entries) {
        if (e.dir) continue;
        list.push({ path: e.path, bytes: await e.getData() });
      }
      const files = list.map((x) => ({
        path: x.path, size: x.bytes.length,
        bytes: async () => x.bytes, text: async () => new TextDecoder().decode(x.bytes),
      }));
      setResult(await analyzePack(files));
      setRaw(list);
      setName(f.name.replace(/\.zip$/i, ""));
      setRemoved([]);
      notify("Validation complete");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Analysis failed", "err");
    } finally {
      setBusy(false);
    }
  }, [notify]);

  const optimize = useCallback(async () => {
    if (!result) return;
    const doomed = new Set(
      result.findings.filter((x) => x.fixable).map((x) => x.file)
    );
    // Never delete pack.mcmeta; keep first copy of duplicates (findings already list only dupes)
    doomed.delete("pack.mcmeta");
    if (doomed.size === 0) { notify("Nothing safe to remove.", "info"); return; }
    if (!confirm(`Remove ${doomed.size} file(s)? The original .zip is never modified — a new optimized .zip is created.`)) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const f of raw) {
        if (doomed.has(f.path)) continue;
        zip.file(f.path, f.bytes);
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
      downloadBlob(blob, `${name || "pack"}-optimized.zip`);
      setRemoved([...doomed]);
      notify("Exported");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Optimize failed", "err");
    } finally {
      setBusy(false);
    }
  }, [result, raw, name, notify]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><Gauge className="size-5 text-emerald-600" aria-hidden /> Pack Optimizer</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Finds duplicates, leftovers, huge textures, broken JSON and invalid files. Nothing is deleted without confirmation, and the original is never touched. <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-slate-700">Local</span></p>
      </div>
      <Dropzone accept=".zip" onFiles={run} label="Drop a .zip to analyze" hint="Duplicate detection uses content hashing · large-file safe" compact />
      {busy && <p className="text-[13px] text-slate-500" role="status">Working…</p>}
      {result && (
        <section className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
            <span className="text-[13.5px] font-bold">{name} — {formatBytes(result.totalBytes)} total</span>
            <span className="text-[12.5px] text-slate-500">{result.findings.length} findings · {formatBytes(result.reclaimableBytes)} safely removable</span>
            <button onClick={optimize} className="ms-auto flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
              <Download className="size-4" aria-hidden /> Optimize Pack
            </button>
          </div>
          {result.findings.length === 0 ? (
            <p className="p-4 text-[13px] text-slate-500">No issues found. This pack is already lean.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {result.findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 px-3 py-2 text-[12.5px]">
                  <Trash2 className={`mt-0.5 size-4 shrink-0 ${f.fixable ? "text-emerald-600" : "text-slate-400"}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <span className="me-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">{f.kind}</span>
                    <span className="font-mono font-bold break-all">{f.file}</span>
                    <span className="block text-slate-600 dark:text-slate-300">{f.detail}</span>
                    {removed.includes(f.file) && <span className="text-emerald-600">Removed in optimized .zip.</span>}
                  </div>
                  <span className="shrink-0 font-mono text-[11.5px] text-slate-500">{f.bytes ? formatBytes(f.bytes) : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
