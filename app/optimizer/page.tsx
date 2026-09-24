"use client";
import { useCallback, useState } from "react";
import JSZip from "jszip";
import { Download, Trash2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { loadZipSafely } from "@/lib/zip-safety";
import { analyzePack, type OptimizeResult } from "@/lib/optimize-pack";
import { formatBytes, downloadBlob } from "@/lib/pixel-utils";
import { Btn } from "@/components/ui";

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
      notify("Analysis complete");
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <p className="text-[13px]" style={{ color: "var(--muted)" }}>
        Finds duplicates, leftovers, huge textures, broken JSON and invalid files. Nothing is deleted without confirmation. <span className="rounded border px-1 font-mono text-[11px]" style={{ borderColor: "var(--border)" }}>Local</span>
      </p>
      <Dropzone accept=".zip" onFiles={run} label={busy ? "Analyzing…" : "Drop a .zip to analyze"} hint="Duplicate detection uses content hashing · large-file safe" compact />

      {result && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <span className="text-[13.5px] font-bold">{name} · {formatBytes(result.totalBytes)}</span>
            <span className="font-mono text-[11.5px]" style={{ color: "var(--muted)" }}>
              {result.findings.length} findings · {formatBytes(result.reclaimableBytes)} safely removable
            </span>
            <span className="ms-auto">
              <Btn primary onClick={optimize} disabled={!result.findings.some((x) => x.fixable)}>
                <Download className="size-4" aria-hidden /> Optimize Pack
              </Btn>
            </span>
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }} aria-label="Findings">
            {result.findings.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5 px-3 py-2">
                <Trash2 className="mt-0.5 size-4 shrink-0" aria-hidden style={{ color: f.fixable ? "var(--accent)" : "var(--faint)" }} />
                <span className="min-w-0 flex-1">
                  <span className="me-2 rounded px-1.5 py-px font-mono text-[11px]" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>{f.kind}</span>
                  <span className="font-mono text-[12.5px] font-bold break-all">{f.file}</span>
                  <span className="block text-[12.5px]" style={{ color: "var(--muted)" }}>{f.detail}</span>
                  {removed.includes(f.file) && <span className="text-[12px]" style={{ color: "var(--accent)" }}>Removed in optimized .zip.</span>}
                </span>
                <span className="shrink-0 font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>{f.bytes ? formatBytes(f.bytes) : "—"}</span>
              </li>
            ))}
          </ul>
          {result.findings.length === 0 && (
            <p className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>No issues found. This pack is already lean.</p>
          )}
        </div>
      )}
    </div>
  );
}
