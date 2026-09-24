"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { openSavedProject } from "@/lib/projects";
import {
  Package, PersonStanding, UserSearch, Grid3x3, TerminalSquare, Server,
  Plus, Trash2, ArrowRight, FolderOpen, HardDrive,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { listProjects, deleteProject, type ProjectRecord } from "@/lib/storage";
import { formatBytes } from "@/lib/pixel-utils";
import { Btn, SectionLabel, EmptyState } from "@/components/ui";

const QUICK = [
  { href: "/resource-pack", icon: Package, en: "Resource Pack", ar: "حزمة الموارد", note: "Import, edit, export .zip" },
  { href: "/skin", icon: PersonStanding, en: "Skin Studio", ar: "استوديو السكن", note: "2D editor + 3D preview" },
  { href: "/pixel-art", icon: Grid3x3, en: "Pixel Art", ar: "فن البكسل", note: "Canvas + image converter" },
  { href: "/profile", icon: UserSearch, en: "Profile Lookup", ar: "بحث الملف", note: "Username, UUID, skin" },
  { href: "/server", icon: Server, en: "Server Status", ar: "حالة السيرفر", note: "Players, version, MOTD" },
  { href: "/commands", icon: TerminalSquare, en: "Commands", ar: "الأوامر", note: "give, summon, tp…" },
];

const KIND_LABEL: Record<string, string> = {
  "resource-pack": "Resource Pack",
  skin: "Skin",
  "pixel-art": "Pixel Art",
  model: "Model",
  other: "File",
};

export default function Dashboard() {
  const { t, lang, notify, setNewProjectOpen } = useApp();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [storageNote, setStorageNote] = useState("");

  const refresh = async () => setProjects(await listProjects());
  useEffect(() => {
    let live = true;
    listProjects().then((p) => { if (live) setProjects(p); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (live && est.usage != null) setStorageNote(`${formatBytes(est.usage)} stored locally`);
        }
      } catch { /* ignore */ }
    })();
    return () => { live = false; };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">{lang === "ar" ? "مساحة العمل" : "Your workspace"}</h1>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>{t.welcomeSub}</p>
        </div>
        <div className="ms-auto flex gap-1.5">
          <Btn primary onClick={() => setNewProjectOpen(true)}>
            <Plus className="size-4" aria-hidden /> {t.newProject}
          </Btn>
          <Btn onClick={() => router.push("/projects")}>
            <FolderOpen className="size-4" aria-hidden /> {t.projects}
          </Btn>
        </div>
      </div>

      <section aria-label={t.recentProjects}>
        <SectionLabel
          right={storageNote ? <span className="flex items-center gap-1 font-mono text-[11px] normal-case tracking-normal" style={{ color: "var(--faint)" }}><HardDrive className="size-3.5" aria-hidden />{storageNote}</span> : undefined}
        >
          {t.recentProjects}
        </SectionLabel>
        {projects.length === 0 ? (
          <div style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)" }}>
            <EmptyState
              title={lang === "ar" ? "لا مشاريع بعد" : "No projects yet"}
              body={lang === "ar" ? "أنشئ أول مشروع ماينكرافت." : "Create your first Minecraft project."}
              action={<Btn primary onClick={() => setNewProjectOpen(true)}><Plus className="size-4" aria-hidden /> {t.newProject}</Btn>}
            />
          </div>
        ) : (
          <ul className="divide-y" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)" }}>
            {projects.slice(0, 5).map((p) => (
              <li key={p.id}>
                <div className="ui-transition flex items-center gap-3 px-3 py-2.5">
                  <button onClick={() => openSavedProject(p, router, notify)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                      <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                        {KIND_LABEL[p.kind] ?? p.kind} · {new Date(p.updatedAt).toLocaleString(lang === "ar" ? "ar" : undefined)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden style={{ color: "var(--faint)" }} />
                  </button>
                  <button
                    onClick={async () => { await deleteProject(p.id); notify(t.del); refresh(); }}
                    aria-label={`Delete ${p.name}`}
                    className="ui-transition rounded p-1.5 hover:opacity-70"
                    style={{ color: "var(--muted)" }}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t.quickTools}>
        <SectionLabel>{t.quickTools}</SectionLabel>
        <ul className="divide-y" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)" }}>
          {QUICK.map(({ href, icon: Icon, en, ar, note }) => (
            <li key={href}>
              <Link href={href} className="ui-transition flex items-center gap-3 px-3 py-2.5 hover:opacity-80">
                <Icon className="size-[18px] shrink-0" aria-hidden style={{ color: "var(--accent)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{lang === "ar" ? ar : en}</span>
                  <span className="block truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{note}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px]" style={{ color: "var(--faint)" }}>{href}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
