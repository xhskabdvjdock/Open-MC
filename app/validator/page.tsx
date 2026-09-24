"use client";
import { useCallback, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { loadZipSafely } from "@/lib/zip-safety";
import { validatePack, type ValidationReport } from "@/lib/validate-pack";

export default function ValidatorPage() {
  const { notify, mcVersion } = useApp();
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const run = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    setBusy(true);
    try {
      const { entries } = await loadZipSafely(f);
      const files = await Promise.all(
        entries.filter((e) => !e.dir).map(async (e) => {
          const bytes = await e.getData();
          return { path: e.path, size: bytes.length, bytes: async () => bytes, text: async () => new TextDecoder().decode(bytes) };
        })
      );
      const rep = await validatePack(files, mcVersion);
      setReport(rep);
      setName(f.name);
      setFocus(null);
      notify("Validation complete");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Validation failed", "err");
    } finally {
      setBusy(false);
    }
  }, [mcVersion, notify]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <p className="text-[13px]" style={{ color: "var(--muted)" }}>
        Checks <span className="font-mono">pack.mcmeta</span>, structure, JSON syntax and model shape for <span className="font-mono font-bold">{mcVersion}</span> — 100% locally.
      </p>
      <Dropzone accept=".zip" onFiles={run} label={busy ? "Validating…" : "Drop a .zip to validate"} hint="Nothing is uploaded — parsed in your browser" compact />

      {report && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: report.ok ? "var(--accent)" : "var(--danger)" }}>
              {report.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
              {report.ok ? "Valid" : "Problems found"}
            </span>
            <span className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>{name}</span>
            <span className="ms-auto flex gap-3 font-mono text-[12px]" style={{ color: "var(--muted)" }}>
              <span><b style={{ color: "var(--danger)" }}>{report.errors.length}</b> errors</span>
              <span><b style={{ color: "var(--warn)" }}>{report.warnings.length}</b> warnings</span>
              <span>{report.checkedFiles} files</span>
            </span>
          </div>
          <ProblemList
            items={[
              ...report.errors.map((e) => ({ ...e, level: "error" as const })),
              ...report.warnings.map((e) => ({ ...e, level: "warning" as const })),
              ...report.infos.map((e) => ({ ...e, level: "info" as const })),
            ]}
            focus={focus}
            setFocus={setFocus}
          />
          {focus && (
            <p className="border-t px-3 py-2 font-mono text-[12px]" style={{ borderColor: "var(--border)" }} role="status">
              <span className="font-bold">{focus}</span> — open it in Resource Pack Studio to fix.
            </p>
          )}
          {report.errors.length === 0 && report.warnings.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 text-[13px]" style={{ color: "var(--accent)" }}>
              <CheckCircle2 className="size-4" aria-hidden /> pack.mcmeta valid · structure valid · {report.checkedFiles} files checked
            </div>
          )}
        </div>
      )}
      {!report && !busy && (
        <p className="text-[12.5px]" style={{ color: "var(--faint)" }}>
          No pack loaded. Drop a <span className="font-mono">.zip</span> above to run diagnostics.
        </p>
      )}
    </div>
  );
}

function ProblemList({ items, focus, setFocus }: {
  items: { level: "error" | "warning" | "info"; file: string; message: string; line?: number }[];
  focus: string | null;
  setFocus: (f: string | null) => void;
}) {
  if (items.length === 0) return null;
  const icon = (l: string) =>
    l === "error"
      ? <XCircle className="size-4 shrink-0" aria-hidden style={{ color: "var(--danger)" }} />
      : l === "warning"
        ? <AlertTriangle className="size-4 shrink-0" aria-hidden style={{ color: "var(--warn)" }} />
        : <CheckCircle2 className="size-4 shrink-0" aria-hidden style={{ color: "var(--accent)" }} />;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--border)" }} aria-label="Problems">
      {items.map((it, i) => (
        <li key={i}>
          <button
            onClick={() => setFocus(focus === it.file ? null : it.file)}
            className="ui-transition flex w-full items-start gap-2.5 px-3 py-2 text-start"
            style={{ background: focus === it.file ? "var(--panel-2)" : "transparent" }}
          >
            {icon(it.level)}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[12.5px] font-bold">{it.file}{it.line ? `:${it.line}` : ""}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--muted)" }}>{it.message}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
