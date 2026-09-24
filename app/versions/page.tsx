"use client";
import { Tags, Check } from "lucide-react";
import { useApp } from "@/components/Providers";
import { MC_VERSIONS, KNOWN_ASSET_DIRS, TEXTURE_DIRS } from "@/lib/versions";

export default function VersionsPage() {
  const { mcVersion, setMcVersion, notify } = useApp();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><Tags className="size-5 text-emerald-600" aria-hidden /> Version Tools</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">One place for Minecraft versions and pack formats. The selected version drives validation and new-pack defaults everywhere in Open MC.</p>
      </div>
      <section aria-label="Minecraft version" className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Active Minecraft version
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {MC_VERSIONS.map((v) => {
            const active = mcVersion === v.id;
            return (
              <li key={v.id}>
                <button
                  onClick={() => { setMcVersion(v.id); notify(`Target version: ${v.id}`); }}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800 ${active ? "bg-emerald-600/8" : ""}`}
                >
                  <span className={`grid size-6 place-items-center rounded border ${active ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent dark:border-slate-600"}`}>
                    <Check className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-24 font-mono text-[13px] font-bold">{v.label}</span>
                  <span className="font-mono text-[12px] text-slate-500">pack_format {v.packFormat}</span>
                  <span className="ms-auto text-[12.5px] text-slate-500 dark:text-slate-400">{v.notes}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1.5 text-[13px] font-bold">Known asset namespaces</h2>
          <p className="mb-2 text-[12px] text-slate-500">Under <code>assets/&lt;namespace&gt;/</code> the validator expects these folders:</p>
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_ASSET_DIRS.map((d) => <code key={d} className="rounded bg-slate-100 px-2 py-1 font-mono text-[12px] dark:bg-slate-800">{d}</code>)}
          </div>
        </section>
        <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1.5 text-[13px] font-bold">Known texture folders</h2>
          <p className="mb-2 text-[12px] text-slate-500">Under <code>assets/&lt;namespace&gt;/textures/</code>:</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXTURE_DIRS.map((d) => <code key={d} className="rounded bg-slate-100 px-2 py-1 font-mono text-[12px] dark:bg-slate-800">{d}</code>)}
          </div>
        </section>
      </div>
      <p className="text-[12px] text-slate-500">To add a future version, edit <code>lib/versions.ts</code> only — validator, optimizer and pack defaults pick it up automatically.</p>
    </div>
  );
}
