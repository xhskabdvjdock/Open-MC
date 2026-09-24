"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Package, PersonStanding, Grid3x3, Box, Image as ImageIcon,
  UserSearch, Server, TerminalSquare, Braces, Database, ShieldCheck, Gauge, Tags,
  Settings as SettingsIcon, Search, Plus, Moon, Sun,
} from "lucide-react";
import { useApp } from "./Providers";

interface Entry {
  icon: React.ElementType;
  en: string;
  ar: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, t, setNewProjectOpen, theme, setTheme, lang } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const go = (href: string) => { setPaletteOpen(false); router.push(href); };

  const entries: Entry[] = useMemo(() => [
    { icon: LayoutDashboard, en: "Home dashboard", ar: "الرئيسية", run: () => go("/") },
    { icon: FolderKanban, en: "Projects", ar: "المشاريع", run: () => go("/projects") },
    { icon: Plus, en: "New project", ar: "مشروع جديد", hint: "dialog", run: () => { setPaletteOpen(false); setNewProjectOpen(true); } },
    { icon: Package, en: "Resource Pack Studio pack zip texture", ar: "حزمة الموارد", run: () => go("/resource-pack") },
    { icon: PersonStanding, en: "Skin Studio steve alex 3d", ar: "استوديو السكن", run: () => go("/skin") },
    { icon: Grid3x3, en: "Pixel Art canvas converter", ar: "فن البكسل", run: () => go("/pixel-art") },
    { icon: Box, en: "Model Studio json 3d", ar: "استوديو الموديل", run: () => go("/model") },
    { icon: ImageIcon, en: "Texture Tools resize crop palette", ar: "أدوات الخامات", run: () => go("/textures") },
    { icon: UserSearch, en: "Profile username uuid skin cape", ar: "الملف الشخصي", run: () => go("/profile") },
    { icon: Server, en: "Server status motd icon java bedrock", ar: "السيرفر", run: () => go("/server") },
    { icon: TerminalSquare, en: "Commands give summon tp effect", ar: "الأوامر", run: () => go("/commands") },
    { icon: Braces, en: "JSON formatter validator minifier", ar: "جسون", run: () => go("/json") },
    { icon: Database, en: "NBT viewer dat level", ar: "ن ب ت", run: () => go("/json?tab=nbt") },
    { icon: ShieldCheck, en: "Validator pack check", ar: "المدقق", run: () => go("/validator") },
    { icon: Gauge, en: "Optimizer duplicates size", ar: "المحسن", run: () => go("/optimizer") },
    { icon: Tags, en: "Versions pack format 1.21", ar: "الإصدارات", run: () => go("/versions") },
    { icon: SettingsIcon, en: "Settings appearance language", ar: "الإعدادات", run: () => go("/settings") },
    { icon: Moon, en: "Action: dark theme", ar: "مظهر داكن", hint: "action", run: () => { setTheme("dark"); setPaletteOpen(false); } },
    { icon: Sun, en: "Action: light theme", ar: "مظهر فاتح", hint: "action", run: () => { setTheme("light"); setPaletteOpen(false); } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [setPaletteOpen, setNewProjectOpen, setTheme]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) =>
      `${e.en} ${e.ar}`.toLowerCase().includes(needle)
    );
  }, [q, entries]);

  useEffect(() => {
    if (paletteOpen) {
      setQ("");
      setIndex(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [paletteOpen]);

  useEffect(() => { setIndex(0); }, [q]);

  if (!paletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[96] p-4" role="dialog" aria-modal="true" aria-label={t.searchTools}>
      <div className="absolute inset-0 bg-black/55" onClick={() => setPaletteOpen(false)} />
      <div
        className="relative mx-auto mt-[8vh] w-full max-w-lg overflow-hidden rounded"
        style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow-pop)" }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
          <Search className="size-4 shrink-0" aria-hidden style={{ color: "var(--faint)" }} />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && results[index]) results[index].run();
              if (e.key === "Escape") setPaletteOpen(false);
            }}
            placeholder={t.commandPalette}
            aria-label={t.searchTools}
            className="w-full bg-transparent text-[14px] outline-none"
          />
          <kbd className="rounded border px-1 font-mono text-[10px]" style={{ borderColor: "var(--border-strong)", color: "var(--faint)" }}>esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5" role="listbox" aria-label={t.searchTools}>
          {results.map((r, i) => (
            <li key={r.en} role="option" aria-selected={i === index}>
              <button
                onMouseEnter={() => setIndex(i)}
                onClick={() => r.run()}
                className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-start text-[13.5px]"
                style={{ background: i === index ? "var(--panel-2)" : "transparent" }}
              >
                <r.icon className="size-4 shrink-0" aria-hidden style={{ color: i === index ? "var(--accent)" : "var(--faint)" }} />
                <span className="truncate">{lang === "ar" ? r.ar : r.en.split(" ").slice(0, 3).join(" ")}</span>
                {r.hint && <span className="ms-auto font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>{r.hint}</span>}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>
              {lang === "ar" ? "لا نتائج" : "No matching tools"}
            </li>
          )}
        </ul>
        <div className="hidden items-center gap-3 border-t px-3 py-1.5 font-mono text-[10.5px] sm:flex" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
          <span>↑↓ navigate</span><span>↵ open</span><span className="ms-auto">{theme} theme</span>
        </div>
      </div>
    </div>
  );
}
