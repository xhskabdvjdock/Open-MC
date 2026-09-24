"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Package, PersonStanding, UserSearch, Grid3x3, TerminalSquare, FolderOpen, Trash2, HardDrive } from "lucide-react";
import { useApp } from "@/components/Providers";
import { listProjects, deleteProject, type ProjectRecord } from "@/lib/storage";
import { formatBytes } from "@/lib/pixel-utils";

const QUICK = [
  { href: "/resource-pack", icon: Package, en: "Resource Pack", ar: "حزمة الموارد" },
  { href: "/skin", icon: PersonStanding, en: "Skin Studio", ar: "استوديو السكن" },
  { href: "/profile", icon: UserSearch, en: "Profile Lookup", ar: "بحث الملف" },
  { href: "/pixel-art", icon: Grid3x3, en: "Pixel Art", ar: "فن البكسل" },
  { href: "/commands", icon: TerminalSquare, en: "Command Generator", ar: "مولد الأوامر" },
];

const ALL = [
  { href: "/resource-pack", en: "Resource Packs — import, edit, export .zip" },
  { href: "/skin", en: "Skins — 2D editor + 3D Steve/Alex preview" },
  { href: "/textures", en: "Textures — resize, crop, palette, filters" },
  { href: "/model", en: "Models — JSON validation + 3D geometry" },
  { href: "/server", en: "Servers — status, MOTD, icon" },
  { href: "/commands", en: "Commands — give/summon/tp/effect…" },
  { href: "/json", en: "JSON / NBT — formatter, validator, viewer" },
  { href: "/profile", en: "Profile + UUID tools" },
  { href: "/validator", en: "Pack validator" },
  { href: "/optimizer", en: "Pack optimizer" },
  { href: "/versions", en: "Version + pack formats" },
  { href: "/pixel-art", en: "Pixel art studio + image converter" },
];

export default function Dashboard() {
  const { t, lang, notify } = useApp();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [storageNote, setStorageNote] = useState("");

  const refresh = async () => setProjects(await listProjects());
  useEffect(() => {
    let live = true;
    listProjects().then((p) => { if (live) setProjects(p); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (est.usage != null) setStorageNote(`${formatBytes(est.usage)} used locally`);
          else setStorageNote("");
        }
      } catch { setStorageNote(""); }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-[22px] font-bold tracking-tight">Open MC</h1>
        <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">{t.welcome}.</span> {t.welcomeSub}
        </p>
      </section>

      <section aria-label={t.quickTools}>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.quickTools}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK.map(({ href, icon: Icon, en, ar }) => (
            <Link key={href} href={href} className="group rounded-md border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">
              <Icon className="mb-2 size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div className="text-[13.5px] font-semibold">{lang === "ar" ? ar : en}</div>
              <div className="font-mono text-[11px] text-slate-400">{href}</div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label={t.recentProjects}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.recentProjects}</h2>
          {storageNote && (
            <span className="flex items-center gap-1 text-[11.5px] text-slate-500 dark:text-slate-400">
              <HardDrive className="size-3.5" aria-hidden /> {storageNote}
            </span>
          )}
        </div>
        {projects.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-slate-300 p-4 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <FolderOpen className="size-5 shrink-0" aria-hidden />
            {t.noProjects}
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {projects.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{p.name}</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
                    {p.kind} · {new Date(p.updatedAt).toLocaleString()} · {typeof p.data === "string" ? `${p.data.length} chars` : "binary"}
                  </div>
                </div>
                <button
                  onClick={async () => { await deleteProject(p.id); notify(t.del); refresh(); }}
                  aria-label={`Delete ${p.name}`}
                  className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t.allTools}>
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.allTools}</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {ALL.map((a) => (
            <Link key={a.href} href={a.href} className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13.5px] hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-900">
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{a.href}</span>
              <span className="block text-slate-700 dark:text-slate-200">{a.en}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
