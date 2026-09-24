"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { kvGet, kvSet } from "@/lib/storage";

export type Theme = "dark" | "light" | "system";

interface Toast { id: number; kind: "ok" | "err" | "info"; text: string }

export interface CurrentProject {
  name: string;
  kind: string;
  dirty: boolean;
}

interface AppCtx {
  lang: Lang; setLang: (l: Lang) => void;
  t: (typeof STRINGS)["en"];
  theme: Theme; setTheme: (t: Theme) => void;
  resolvedDark: boolean;
  mcVersion: string; setMcVersion: (v: string) => void;
  showGrid: boolean; setShowGrid: (v: boolean) => void;
  autosave: boolean; setAutosave: (v: boolean) => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
  sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
  paletteOpen: boolean; setPaletteOpen: (v: boolean) => void;
  newProjectOpen: boolean; setNewProjectOpen: (v: boolean) => void;
  project: CurrentProject | null; setProject: (p: CurrentProject | null) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

let toastId = 1;

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mcVersion, setMcVersionState] = useState("1.21.4");
  const [showGrid, setShowGridState] = useState(true);
  const [autosave, setAutosaveState] = useState(true);
  const [collapsed, setCollapsedState] = useState(false);
  const [resolvedDark, setResolvedDark] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [project, setProject] = useState<CurrentProject | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const [l, th, mv, as, sg, col] = await Promise.all([
        kvGet<Lang>("lang", "en"),
        kvGet<Theme>("theme", "dark"),
        kvGet<string>("mcVersion", "1.21.4"),
        kvGet<boolean>("autosave", true),
        kvGet<boolean>("showGrid", true),
        kvGet<boolean>("sidebarCollapsed", false),
      ]);
      if (!live) return;
      setLangState(l); setThemeState(th); setMcVersionState(mv);
      setAutosaveState(as); setShowGridState(sg); setCollapsedState(col);
    })();
    return () => { live = false; };
  }, []);

  const setLang = useCallback((l: Lang) => { setLangState(l); kvSet("lang", l); }, []);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); kvSet("theme", t); }, []);
  const setMcVersion = useCallback((v: string) => { setMcVersionState(v); kvSet("mcVersion", v); }, []);
  const setShowGrid = useCallback((v: boolean) => { setShowGridState(v); kvSet("showGrid", v); }, []);
  const setAutosave = useCallback((v: boolean) => { setAutosaveState(v); kvSet("autosave", v); }, []);
  const setCollapsed = useCallback((v: boolean) => { setCollapsedState(v); kvSet("sidebarCollapsed", v); }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      setResolvedDark(dark);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // Global Ctrl+K command palette (works everywhere, including inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notify = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const t = useMemo(() => STRINGS[lang] as unknown as (typeof STRINGS)["en"], [lang]);

  const value: AppCtx = {
    lang, setLang, t, theme, setTheme, resolvedDark,
    mcVersion, setMcVersion, showGrid, setShowGrid,
    autosave, setAutosave, notify,
    sidebarOpen, setSidebarOpen, collapsed, setCollapsed,
    paletteOpen, setPaletteOpen, newProjectOpen, setNewProjectOpen,
    project, setProject,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="ui-transition min-w-52 max-w-80 rounded px-3 py-2 text-[13px]"
            style={{
              background: "var(--panel)",
              border: `1px solid ${toast.kind === "err" ? "var(--danger)" : "var(--border-strong)"}`,
              color: toast.kind === "err" ? "var(--danger)" : "var(--text)",
              boxShadow: "var(--shadow-pop)",
            }}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
