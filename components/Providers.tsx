"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STRINGS, type Lang } from "@/lib/i18n";
import { kvGet, kvSet } from "@/lib/storage";

export type Theme = "dark" | "light" | "system";

interface Toast { id: number; kind: "ok" | "err" | "info"; text: string }

interface AppCtx {
  lang: Lang; setLang: (l: Lang) => void;
  t: (typeof STRINGS)["en"];
  theme: Theme; setTheme: (t: Theme) => void;
  resolvedDark: boolean;
  mcVersion: string; setMcVersion: (v: string) => void;
  showGrid: boolean; setShowGrid: (v: boolean) => void;
  autosave: boolean; setAutosave: (v: boolean) => void;
  notify: (text: string, kind?: Toast["kind"]) => void;
  query: string; setQuery: (q: string) => void;
  sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void;
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
  const [showGrid, setShowGrid] = useState(true);
  const [autosave, setAutosave] = useState(true);
  const [resolvedDark, setResolvedDark] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLangState(await kvGet<Lang>("lang", "en"));
      setThemeState(await kvGet<Theme>("theme", "dark"));
      setMcVersionState(await kvGet<string>("mcVersion", "1.21.4"));
      setAutosave(await kvGet<boolean>("autosave", true));
      setShowGrid(await kvGet<boolean>("showGrid", true));
    })();
  }, []);

  const setLang = useCallback((l: Lang) => { setLangState(l); kvSet("lang", l); }, []);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); kvSet("theme", t); }, []);
  const setMcVersion = useCallback((v: string) => { setMcVersionState(v); kvSet("mcVersion", v); }, []);

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

  const notify = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const t = useMemo(() => STRINGS[lang] as unknown as (typeof STRINGS)["en"], [lang]);

  const value: AppCtx = {
    lang, setLang, t, theme, setTheme, resolvedDark,
    mcVersion, setMcVersion, showGrid, setShowGrid,
    autosave, setAutosave, notify, query, setQuery,
    sidebarOpen, setSidebarOpen,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`min-w-52 max-w-80 rounded-md border px-3 py-2 text-[13px] shadow-lg ${
              toast.kind === "err"
                ? "border-red-500/40 bg-red-950 text-red-100 dark:bg-red-950"
                : toast.kind === "info"
                  ? "border-sky-500/30 bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
                  : "border-emerald-500/30 bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
