"use client";
import { Menu, Search, Sun, Moon, Laptop, Languages } from "lucide-react";
import { useApp } from "./Providers";
import { useRouter, usePathname } from "next/navigation";

const TOOL_INDEX = [
  { href: "/resource-pack", en: "Resource Pack Studio pack zip explorer texture", ar: "حزمة الموارد" },
  { href: "/skin", en: "Skin Studio steve alex 3d editor", ar: "السكن" },
  { href: "/pixel-art", en: "Pixel Art canvas image converter", ar: "فن البكسل" },
  { href: "/model", en: "Model Studio json blockbench 3d", ar: "موديل" },
  { href: "/textures", en: "Texture Tools resize crop rotate pixelate", ar: "الخامات" },
  { href: "/json", en: "JSON NBT formatter validator minifier viewer", ar: "جسون" },
  { href: "/commands", en: "Commands give summon tp effect enchant", ar: "الأوامر" },
  { href: "/profile", en: "Profile username uuid skin cape", ar: "الملف الشخصي" },
  { href: "/server", en: "Server status motd icon java bedrock", ar: "السيرفر" },
  { href: "/validator", en: "Validator pack.mcmeta check", ar: "المدقق" },
  { href: "/optimizer", en: "Optimizer duplicates size", ar: "المحسن" },
  { href: "/versions", en: "Version pack format 1.21 1.20", ar: "الإصدارات" },
];

export function Topbar() {
  const { t, lang, setLang, theme, setTheme, query, setQuery, setSidebarOpen } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  const results = query.trim()
    ? TOOL_INDEX.filter((x) =>
        (x.en + " " + x.ar + " " + x.href).toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 7)
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex h-13 items-center gap-2 px-3 py-2 sm:px-4">
        <button
          className="rounded-md p-2 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="relative hidden w-72 sm:block">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                router.push(results[0].href);
                setQuery("");
              }
              if (e.key === "Escape") setQuery("");
            }}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchTools}
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pe-3 ps-8 text-[13px] outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
          />
          {results.length > 0 && (
            <div className="absolute start-0 top-full mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {results.map((r) => (
                <button
                  key={r.href}
                  onClick={() => { router.push(r.href); setQuery(""); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-mono text-[11px] text-slate-400">{r.href}</span>
                  <span className="truncate">{r.en.split(" ").slice(0, 3).join(" ")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ms-auto flex items-center gap-1">
          <span className="me-1 hidden rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 lg:inline dark:border-slate-700 dark:text-slate-400" title={pathname}>
            {pathname}
          </span>
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            aria-label="Switch language"
            title={t.language}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Languages className="size-4" aria-hidden />
            {lang === "en" ? "ع" : "EN"}
          </button>
          <div className="flex items-center rounded-md border border-slate-200 p-0.5 dark:border-slate-700" role="group" aria-label={t.appearance}>
            {(
              [
                { v: "dark", Icon: Moon },
                { v: "light", Icon: Sun },
                { v: "system", Icon: Laptop },
              ] as const
            ).map(({ v, Icon }) => (
              <button
                key={v}
                onClick={() => setTheme(v)}
                aria-label={v}
                aria-pressed={theme === v}
                title={v}
                className={`rounded p-1.5 ${theme === v ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
