"use client";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Trash2, HardDrive } from "lucide-react";
import { useApp } from "@/components/Providers";
import { MC_VERSIONS } from "@/lib/versions";
import { kvGet } from "@/lib/storage";
import { formatBytes } from "@/lib/pixel-utils";

export default function SettingsPage() {
  const {
    theme, setTheme, lang, setLang, mcVersion, setMcVersion,
    showGrid, setShowGrid, autosave, setAutosave, notify,
  } = useApp();
  const [usage, setUsage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          setUsage(`${formatBytes(est.usage ?? 0)} used${est.quota ? ` of ${formatBytes(est.quota)}` : ""}`);
        }
        await kvGet("lang", "en");
      } catch { setUsage(""); }
    })();
  }, []);

  const clearAutosaves = async () => {
    if (!confirm("Delete autosaved data and all local projects?")) return;
    try {
      const dbs = await indexedDB.databases?.();
      for (const d of dbs ?? []) {
        if (d.name === "openmc") indexedDB.deleteDatabase(d.name!);
      }
      localStorage.clear();
      notify("Local data cleared");
      setUsage("");
    } catch {
      notify("Could not clear storage.", "err");
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><SettingsIcon className="size-5 text-emerald-600" aria-hidden /> Settings</h1>

      <SettingCard title="Appearance">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Theme">
          {(["dark", "light", "system"] as const).map((v) => (
            <button key={v} role="radio" aria-checked={theme === v} onClick={() => { setTheme(v); notify(`Theme: ${v}`); }} className={`rounded-md border px-3 py-1.5 text-[13px] font-semibold capitalize ${theme === v ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 hover:border-emerald-500 dark:border-slate-700"}`}>
              {v}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-slate-500">Light mode is a full light theme — not an inverted dark mode.</p>
      </SettingCard>

      <SettingCard title="Language / اللغة">
        <div className="flex gap-1.5">
          {(["en", "ar"] as const).map((v) => (
            <button key={v} onClick={() => { setLang(v); notify(v === "ar" ? "تم التبديل إلى العربية" : "Switched to English"); }} aria-pressed={lang === v} className={`rounded-md border px-3 py-1.5 text-[13px] font-semibold ${lang === v ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 hover:border-emerald-500 dark:border-slate-700"}`}>
              {v === "en" ? "English" : "العربية (RTL)"}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-slate-500">Arabic flips the entire layout to right-to-left (dir=rtl).</p>
      </SettingCard>

      <SettingCard title="Minecraft version">
        <select value={mcVersion} onChange={(e) => { setMcVersion(e.target.value); notify(`Target version: ${e.target.value}`); }} aria-label="Minecraft version" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950">
          {MC_VERSIONS.map((v) => <option key={v.id} value={v.id}>{v.label} ({v.id}) — pack_format {v.packFormat}</option>)}
        </select>
      </SettingCard>

      <SettingCard title="Editor preferences">
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="accent-emerald-600" />
          Show pixel grid by default
        </label>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} className="accent-emerald-600" />
          Autosave editors locally (IndexedDB)
        </label>
        <p className="text-[12px] text-slate-500">Keyboard: Ctrl+S save · Ctrl+Z undo · Ctrl+Shift+Z redo · Ctrl+O open · Ctrl+E export. Shortcuts are active inside editors that support them.</p>
      </SettingCard>

      <SettingCard title="Storage">
        <p className="flex items-center gap-1.5 text-[13px]"><HardDrive className="size-4" aria-hidden /> {usage || "Storage estimate unavailable in this browser."}</p>
        <button onClick={clearAutosaves} className="flex w-fit items-center gap-1.5 rounded-md border border-red-500/50 px-3 py-1.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
          <Trash2 className="size-4" aria-hidden /> Clear local data
        </button>
      </SettingCard>

      <SettingCard title="Privacy">
        <ul className="list-inside list-disc space-y-1 text-[13px] text-slate-600 dark:text-slate-300">
          <li>Pack, skin, texture, pixel-art, model and JSON/NBT tools run <strong>100% on your device</strong>.</li>
          <li>Only Profile and Server tools use the network — each is labeled “Requires network” and goes through a minimal proxy with 1–5 min caching.</li>
          <li>No account, no tracking, no uploads of your files.</li>
        </ul>
      </SettingCard>
    </div>
  );
}

function SettingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="mb-2.5 text-[14px] font-bold">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
