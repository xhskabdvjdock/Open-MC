"use client";
import { useEffect, useState } from "react";
import { HardDrive, Trash2 } from "lucide-react";
import { useApp } from "@/components/Providers";
import { MC_VERSIONS } from "@/lib/versions";

import { formatBytes } from "@/lib/pixel-utils";
import { Btn, inputStyle, inputCls } from "@/components/ui";

export default function SettingsPage() {
  const {
    theme, setTheme, lang, setLang, mcVersion, setMcVersion,
    showGrid, setShowGrid, autosave, setAutosave, notify,
  } = useApp();
  const [usage, setUsage] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (live) setUsage(`${formatBytes(est.usage ?? 0)} used${est.quota ? ` of ${formatBytes(est.quota)}` : ""}`);
        }
      } catch { if (live) setUsage(""); }
    })();
    return () => { live = false; };
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
    <div className="mx-auto flex w-full max-w-2xl flex-col divide-y" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
      <header className="px-4 py-3">
        <h1 className="text-[15px] font-bold tracking-tight">Settings</h1>
        <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
          Compact, desktop-app style. <span className="font-mono">Ctrl+K</span> to search tools anywhere.
        </p>
      </header>

      <FieldRow title="Appearance" desc="Light is a full light theme — not inverted dark.">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Theme">
          {(["dark", "light", "system"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={theme === v}
              onClick={() => { setTheme(v); notify(`Theme: ${v}`); }}
              className="ui-transition rounded border px-3 py-1.5 text-[13px] font-semibold capitalize"
              style={{
                borderColor: theme === v ? "var(--accent)" : "var(--border)",
                background: theme === v ? "var(--accent)" : "transparent",
                color: theme === v ? "#fff" : "var(--text)",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow title="Language / اللغة" desc="Arabic flips the entire layout (dir=rtl), including sidebar, breadcrumbs, and editors.">
        <div className="flex gap-1.5">
          {(["en", "ar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setLang(v); notify(v === "ar" ? "تم التبديل إلى العربية" : "Switched to English"); }}
              aria-pressed={lang === v}
              className="ui-transition rounded border px-3 py-1.5 text-[13px] font-semibold"
              style={{
                borderColor: lang === v ? "var(--accent)" : "var(--border)",
                background: lang === v ? "var(--accent)" : "transparent",
                color: lang === v ? "#fff" : "var(--text)",
              }}
            >
              {v === "en" ? "English" : "العربية (RTL)"}
            </button>
          ))}
        </div>
      </FieldRow>

      <FieldRow title="Minecraft version">
        <select value={mcVersion} onChange={(e) => { setMcVersion(e.target.value); notify(`Target version: ${e.target.value}`); }} aria-label="Minecraft version" className={inputCls} style={inputStyle()}>
          {MC_VERSIONS.map((v) => <option key={v.id} value={v.id}>{v.label} ({v.id}) — pack_format {v.packFormat}</option>)}
        </select>
      </FieldRow>

      <FieldRow title="Editor">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
            Pixel grid on by default
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={autosave} onChange={(e) => setAutosave(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
            Autosave editors locally (IndexedDB)
          </label>
          <p className="text-[11.5px]" style={{ color: "var(--faint)" }}>
            Shortcuts: <span className="font-mono">Ctrl+S</span> save · <span className="font-mono">Ctrl+Z</span> undo · <span className="font-mono">Ctrl+Shift+Z</span> redo ·
            <span className="font-mono"> Ctrl+O</span> open · <span className="font-mono">Ctrl+E</span> export · <span className="font-mono">Ctrl+K</span> palette · <span className="font-mono">Del</span> delete.
          </p>
        </div>
      </FieldRow>

      <FieldRow title="Storage" desc={usage || "Storage estimate unavailable in this browser."}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
            <HardDrive className="size-4" aria-hidden style={{ color: "var(--faint)" }} /> {usage || "—"}
          </span>
          <span className="ms-auto">
            <Btn onClick={clearAutosaves} danger>
              <Trash2 className="size-4" aria-hidden /> Clear local data
            </Btn>
          </span>
        </div>
      </FieldRow>

      <FieldRow title="Privacy">
        <ul className="list-inside list-disc space-y-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
          <li>Pack, skin, texture, pixel-art, model and JSON/NBT run <strong className="font-semibold" style={{ color: "var(--text)" }}>100% locally</strong>.</li>
          <li>Only Profile and Server use the network — each is labeled “Requires network”.</li>
          <li>No account, no tracking, no uploads.</li>
        </ul>
      </FieldRow>
    </div>
  );
}

function FieldRow({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[180px_1fr]">
      <div>
        <h2 className="text-[13px] font-bold">{title}</h2>
        {desc && <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>{desc}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
