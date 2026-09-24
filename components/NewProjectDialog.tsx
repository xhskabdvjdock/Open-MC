"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, PersonStanding, Grid3x3, Box } from "lucide-react";
import { useApp } from "./Providers";
import { Dialog, Btn, Field, inputCls, inputStyle } from "./ui";

export interface NewProjectSeed {
  kind: "resource-pack" | "skin" | "pixel-art" | "model";
  name: string;
}

const TYPES: { id: NewProjectSeed["kind"]; href: string; icon: React.ElementType; en: string; ar: string }[] = [
  { id: "resource-pack", href: "/resource-pack", icon: Package, en: "Resource Pack", ar: "حزمة موارد" },
  { id: "skin", href: "/skin", icon: PersonStanding, en: "Skin", ar: "سكن" },
  { id: "pixel-art", href: "/pixel-art", icon: Grid3x3, en: "Pixel Art", ar: "فن بكسل" },
  { id: "model", href: "/model", icon: Box, en: "Model", ar: "موديل" },
];

export function NewProjectDialog() {
  const { newProjectOpen, setNewProjectOpen, lang } = useApp();
  const router = useRouter();
  const [kind, setKind] = useState<NewProjectSeed["kind"]>("resource-pack");
  const [name, setName] = useState("");

  if (!newProjectOpen) return null;

  const create = () => {
    const clean = name.trim() || `My ${TYPES.find((t) => t.id === kind)?.en}`;
    try {
      sessionStorage.setItem("openmc-new-project", JSON.stringify({ kind, name: clean }));
    } catch { /* ignore */ }
    setNewProjectOpen(false);
    setName("");
    router.push(TYPES.find((t) => t.id === kind)!.href);
  };

  return (
    <Dialog title={lang === "ar" ? "مشروع جديد" : "New Project"} onClose={() => setNewProjectOpen(false)}>
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Project type">
          {TYPES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={kind === t.id}
              onClick={() => setKind(t.id)}
              className="ui-transition flex items-center gap-2 rounded border px-3 py-2.5 text-[13px] font-semibold"
              style={{
                borderColor: kind === t.id ? "var(--accent)" : "var(--border)",
                background: kind === t.id ? "var(--accent-soft)" : "transparent",
              }}
            >
              <t.icon className="size-4 shrink-0" aria-hidden style={{ color: kind === t.id ? "var(--accent)" : "var(--muted)" }} />
              {lang === "ar" ? t.ar : t.en}
            </button>
          ))}
        </div>
        <Field label={lang === "ar" ? "اسم المشروع" : "Project name"}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") create(); }}
            placeholder={lang === "ar" ? "حزمتي" : "My Pack"}
            maxLength={60}
            className={inputCls}
            style={inputStyle()}
          />
        </Field>
        <div className="flex justify-end gap-1.5">
          <Btn onClick={() => setNewProjectOpen(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Btn>
          <Btn primary onClick={create}>{lang === "ar" ? "إنشاء" : "Create"}</Btn>
        </div>
      </div>
    </Dialog>
  );
}

export function consumeNewProject(kind: NewProjectSeed["kind"]): string | null {
  try {
    const raw = sessionStorage.getItem("openmc-new-project");
    if (!raw) return null;
    const seed = JSON.parse(raw) as NewProjectSeed;
    if (seed.kind !== kind) return null;
    sessionStorage.removeItem("openmc-new-project");
    return seed.name;
  } catch {
    return null;
  }
}
