"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, PersonStanding, Grid3x3, Box, Image as ImageIcon,
  Braces, TerminalSquare, UserSearch, Server, ShieldCheck, Gauge, Tags, Settings as SettingsIcon, X, Cuboid,
} from "lucide-react";
import { useApp } from "./Providers";

const NAV: { section: "dashboard" | "create" | "tools" | "utility" | "settings"; href: string; icon: React.ElementType; key: string }[] = [
  { section: "dashboard", href: "/", icon: LayoutDashboard, key: "dashboard" },
  { section: "create", href: "/resource-pack", icon: Package, key: "resourcePack" },
  { section: "create", href: "/skin", icon: PersonStanding, key: "skinStudio" },
  { section: "create", href: "/pixel-art", icon: Grid3x3, key: "pixelArt" },
  { section: "create", href: "/model", icon: Box, key: "modelStudio" },
  { section: "tools", href: "/textures", icon: ImageIcon, key: "textureTools" },
  { section: "tools", href: "/json", icon: Braces, key: "jsonNbt" },
  { section: "tools", href: "/commands", icon: TerminalSquare, key: "commands" },
  { section: "tools", href: "/profile", icon: UserSearch, key: "profile" },
  { section: "tools", href: "/server", icon: Server, key: "serverTools" },
  { section: "utility", href: "/validator", icon: ShieldCheck, key: "validator" },
  { section: "utility", href: "/optimizer", icon: Gauge, key: "optimizer" },
  { section: "utility", href: "/versions", icon: Tags, key: "versionTools" },
  { section: "settings", href: "/settings", icon: SettingsIcon, key: "settings" },
];

export function Sidebar() {
  const { t, sidebarOpen, setSidebarOpen } = useApp();
  const pathname = usePathname();
  const sections: Record<string, string> = { dashboard: "", create: t.create, tools: t.tools, utility: t.utility, settings: "" };

  const body = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <span className="grid size-8 place-items-center rounded-md bg-emerald-600 text-white">
          <Cuboid className="size-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">{t.appName}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.tagline}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {(Object.keys(sections) as (keyof typeof sections)[]).map((sec) => (
          <div key={sec} className="mt-1">
            {sections[sec] && (
              <div className="px-2 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {sections[sec]}
              </div>
            )}
            {NAV.filter((n) => n.section === sec).map((n) => {
              const active = pathname === n.href;
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] transition-colors ${
                    active
                      ? "bg-emerald-600/12 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="size-[17px] shrink-0" aria-hidden />
                  <span className="truncate">{(t as Record<string, string>)[n.key] ?? n.key}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Local-first · v1.0
      </div>
    </nav>
  );

  return (
    <>
      {/* desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-e border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-950">
        {body}
      </aside>
      {/* mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute start-0 top-0 h-full w-72 border-e border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <button onClick={() => setSidebarOpen(false)} aria-label="Close menu" className="absolute end-2 top-2 rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="size-5" />
            </button>
            {body}
          </aside>
        </div>
      )}
    </>
  );
}
