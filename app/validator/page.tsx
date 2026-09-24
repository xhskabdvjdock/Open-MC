"use client";
import { useCallback, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><ShieldCheck className="size-5 text-emerald-600" aria-hidden /> Resource Pack Validator</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Real checks against <span className="font-mono">pack.mcmeta</span>, folder structure, JSON syntax and model shape — for version <span className="font-mono font-bold">{mcVersion}</span>. Runs 100% locally. <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-slate-700">Local</span></p>
      </div>
      <Dropzone accept=".zip" onFiles={run} label="Drop a .zip to validate" hint="Nothing is uploaded — parsed in your browser" compact />
      {busy && <p className="text-[13px] text-slate-500" role="status">Validating…</p>}
      {report && (
        <section aria-label="Validation report" className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
            <span className={`flex items-center gap-1.5 rounded px-2 py-1 text-[13px] font-bold ${report.ok ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : "bg-red-600/10 text-red-700 dark:text-red-300"}`}>
              {report.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
              {report.ok ? "Pack looks valid" : "Problems found"} — {name}
            </span>
            <span className="ms-auto text-[12px] text-slate-500">{report.checkedFiles} files checked</span>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-3">
            <IssueList title="Errors" icon={XCircle} color="text-red-600" items={report.errors} focus={focus} setFocus={setFocus} empty="No errors." />
            <IssueList title="Warnings" icon={AlertTriangle} color="text-amber-600" items={report.warnings} focus={focus} setFocus={setFocus} empty="No warnings." />
            <IssueList title="Info" icon={Info} color="text-sky-600" items={report.infos} focus={focus} setFocus={setFocus} empty="Nothing to note." />
          </div>
          {focus && (
            <p className="border-t border-slate-200 px-3 py-2 font-mono text-[12px] dark:border-slate-700" role="status">
              Selected file: <span className="font-bold">{focus}</span> — open it in Resource Pack Studio to fix.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function IssueList({ title, icon: Icon, color, items, focus, setFocus, empty }: {
  title: string; icon: React.ElementType; color: string;
  items: { file: string; message: string; line?: number }[];
  focus: string | null; setFocus: (f: string | null) => void; empty: string;
}) {
  return (
    <div>
      <h2 className={`mb-1.5 flex items-center gap-1.5 text-[13px] font-bold ${color}`}>
        <Icon className="size-4" aria-hidden /> {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-slate-500">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li key={i}>
              <button
                onClick={() => setFocus(focus === it.file ? null : it.file)}
                className={`w-full rounded-md border px-2.5 py-2 text-start text-[12.5px] hover:border-emerald-500 dark:hover:border-emerald-500 ${focus === it.file ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 dark:border-slate-700"}`}
              >
                <span className="block truncate font-mono font-bold">{it.file}{it.line ? `:${it.line}` : ""}</span>
                <span className="block text-slate-600 dark:text-slate-300">{it.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
