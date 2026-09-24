"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, Settings as SettingsIcon, CircleDot } from "lucide-react";
import { useApp } from "./Providers";

const CRUMBS: Record<string, string> = {
  "": "home",
  projects: "projects",
  "resource-pack": "resourcePack",
  skin: "skinStudio",
  "pixel-art": "pixelArt",
  model: "modelStudio",
  textures: "textureTools",
  json: "jsonNbt",
  commands: "commands",
  profile: "profile",
  server: "serverTools",
  validator: "validator",
  optimizer: "optimizer",
  versions: "versionTools",
  settings: "settings",
};

export function Topbar() {
  const { t, lang, setLang, setSidebarOpen, setPaletteOpen, project } = useApp();
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  const s = (k: string) => (t as unknown as Record<string, string>)[k] ?? k;

  const crumbTrail = [{ href: "/", label: s(CRUMBS[""]) }, ...segs.map((seg, i) => ({
    href: "/" + segs.slice(0, i + 1).join("/"),
    label: s(CRUMBS[seg] ?? seg),
  }))];

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--border)", background: "var(--panel)" }}
    >
      <div className="flex h-12 items-center gap-1.5 px-2.5 sm:px-3.5">
        <button
          className="ui-transition rounded p-2 md:hidden"
          style={{ color: "var(--muted)" }}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px]">
          {crumbTrail.map((c, i) => (
            <span key={c.href + i} className="flex min-w-0 items-center gap-1">
              {i > 0 && <span aria-hidden style={{ color: "var(--faint)" }}>/</span>}
              {i === crumbTrail.length - 1 ? (
                <span className="truncate font-semibold" aria-current="page">{c.label}</span>
              ) : (
                <Link href={c.href} className="ui-transition shrink-0 hover:underline" style={{ color: "var(--muted)" }}>
                  {c.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {project && (
          <span
            className="ms-2 hidden items-center gap-1.5 truncate rounded border px-2 py-[3px] font-mono text-[11.5px] sm:flex"
            style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--muted)" }}
            title={`${project.kind} — ${project.name}${project.dirty ? " (unsaved changes)" : ""}`}
          >
            <CircleDot
              className="size-3 shrink-0"
              aria-hidden
              style={{ color: project.dirty ? "var(--warn)" : "var(--accent)" }}
            />
            <span className="truncate">{project.name}</span>
            {project.dirty && <span aria-label="Unsaved changes">•</span>}
          </span>
        )}

        <div className="ms-auto flex items-center gap-0.5">
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label={s("searchTools")}
            className="ui-transition hidden items-center gap-2 rounded border px-2.5 py-[5px] text-[12.5px] sm:flex"
            style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--muted)" }}
          >
            <Search className="size-3.5" aria-hidden />
            <span>{s("searchTools")}</span>
            <kbd className="rounded border px-1 font-mono text-[10px]" style={{ borderColor: "var(--border-strong)" }}>Ctrl K</kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            aria-label={s("searchTools")}
            className="ui-transition rounded p-2 sm:hidden"
            style={{ color: "var(--muted)" }}
          >
            <Search className="size-[18px]" aria-hidden />
          </button>
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            aria-label={s("language")}
            title={s("language")}
            className="ui-transition rounded px-2 py-2 text-[12.5px] font-bold"
            style={{ color: "var(--muted)" }}
          >
            {lang === "en" ? "ع" : "EN"}
          </button>
          <Link
            href="/settings"
            aria-label={s("settings")}
            title={s("settings")}
            className="ui-transition rounded p-2"
            style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--muted)" }}
          >
            <SettingsIcon className="size-[18px]" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
