"use client";
import { Check } from "lucide-react";
import { useApp } from "@/components/Providers";
import { MC_VERSIONS, KNOWN_ASSET_DIRS, TEXTURE_DIRS } from "@/lib/versions";

export default function VersionsPage() {
  const { mcVersion, setMcVersion, notify } = useApp();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <p className="text-[13px]" style={{ color: "var(--muted)" }}>
        One place for Minecraft versions and pack formats. The selected version drives validation and new-pack defaults everywhere.
      </p>
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }} aria-label="Minecraft version">
        <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          Active target
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {MC_VERSIONS.map((v) => {
            const active = mcVersion === v.id;
            return (
              <li key={v.id}>
                <button
                  onClick={() => { setMcVersion(v.id); notify(`Target version: ${v.id}`); }}
                  aria-pressed={active}
                  className={`ui-transition flex w-full items-center gap-3 px-3 py-2 text-start ${active ? "file-row" : ""}`}
                  data-active={active}
                  style={{ background: active ? "var(--panel-2)" : "transparent" }}
                >
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded-sm border text-transparent"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      background: active ? "var(--accent)" : "transparent",
                      color: active ? "#fff" : "transparent",
                    }}
                  >
                    <Check className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-20 font-mono text-[13px] font-bold">{v.label}</span>
                  <span className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>pack_format {v.packFormat}</span>
                  <span className="ms-auto hidden text-[12.5px] sm:inline" style={{ color: "var(--muted)" }}>{v.notes}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>Known asset folders</h2>
          <p className="mb-2 text-[12px]" style={{ color: "var(--muted)" }}>Under <span className="font-mono">assets/&lt;namespace&gt;/</span> the validator expects:</p>
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_ASSET_DIRS.map((d) => <code key={d} className="rounded px-1.5 py-1 font-mono text-[11.5px]" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>{d}</code>)}
          </div>
        </section>
        <section className="rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>Known texture folders</h2>
          <p className="mb-2 text-[12px]" style={{ color: "var(--muted)" }}>Under <span className="font-mono">assets/&lt;namespace&gt;/textures/</span>:</p>
          <div className="flex flex-wrap gap-1.5">
            {TEXTURE_DIRS.map((d) => <code key={d} className="rounded px-1.5 py-1 font-mono text-[11.5px]" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>{d}</code>)}
          </div>
        </section>
      </div>
      <p className="font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>To add a future version, edit <span className="font-bold">lib/versions.ts</span> only — validator and pack defaults pick it up automatically.</p>
    </div>
  );
}
