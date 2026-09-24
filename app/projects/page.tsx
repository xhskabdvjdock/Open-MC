"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowRight, Download } from "lucide-react";
import { useApp } from "@/components/Providers";
import { listProjects, deleteProject, type ProjectRecord } from "@/lib/storage";
import { formatBytes, downloadBlob } from "@/lib/pixel-utils";
import { Btn, SectionLabel, EmptyState } from "@/components/ui";
import { openSavedProject } from "@/lib/projects";

const KIND_LABEL: Record<string, string> = {
  "resource-pack": "Resource Pack",
  skin: "Skin",
  "pixel-art": "Pixel Art",
  model: "Model",
  other: "File",
};

export default function ProjectsPage() {
  const { t, lang, notify, setNewProjectOpen } = useApp();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    let live = true;
    listProjects().then((p) => { if (live) setProjects(p); });
    return () => { live = false; };
  }, []);

  const download = (p: ProjectRecord) => {
    if (typeof p.data === "string") {
      downloadBlob(new Blob([p.data], { type: "text/plain" }), `${p.name}.txt`);
    } else {
      const ext = p.kind === "resource-pack" ? "zip" : "png";
      downloadBlob(p.data, `${p.name}.${ext}`);
    }
    notify(t.download);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <div className="flex items-end gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">{t.projects}</h1>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {lang === "ar" ? "كل مشاريعك محفوظة محلياً في متصفحك." : "Everything here is stored locally in your browser (IndexedDB)."}
          </p>
        </div>
        <span className="ms-auto">
          <Btn primary onClick={() => setNewProjectOpen(true)}>
            <Plus className="size-4" aria-hidden /> {t.newProject}
          </Btn>
        </span>
      </div>

      <section aria-label={t.projects}>
        <SectionLabel>{projects.length} {lang === "ar" ? "مشروع" : projects.length === 1 ? "project" : "projects"}</SectionLabel>
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
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                <button onClick={() => openSavedProject(p, router, notify)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                    <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                      {KIND_LABEL[p.kind] ?? p.kind} · {new Date(p.updatedAt).toLocaleString(lang === "ar" ? "ar" : undefined)}
                      {typeof p.data === "object" ? ` · ${formatBytes(p.data.size)}` : ""}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden style={{ color: "var(--faint)" }} />
                </button>
                <button
                  onClick={() => download(p)}
                  aria-label={`Download ${p.name}`}
                  title={t.download}
                  className="ui-transition rounded p-1.5"
                  style={{ color: "var(--muted)" }}
                >
                  <Download className="size-4" aria-hidden />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${p.name}"?`)) return;
                    await deleteProject(p.id);
                    setProjects(await listProjects());
                    notify(t.del);
                  }}
                  aria-label={`Delete ${p.name}`}
                  className="ui-transition rounded p-1.5"
                  style={{ color: "var(--muted)" }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
