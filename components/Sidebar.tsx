"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Package, PersonStanding, Grid3x3, Box, Image as ImageIcon,
  UserSearch, Server, TerminalSquare, Braces, Database, ShieldCheck, Gauge, Tags,
  Settings as SettingsIcon, X, ChevronsLeft, ChevronsRight, Cuboid,
} from "lucide-react";
import { useApp } from "./Providers";
import { Tip } from "./ui";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  match: (path: string, tab: string | null) => boolean;
}

export function Sidebar() {
  const { t, sidebarOpen, setSidebarOpen, collapsed, setCollapsed, lang } = useApp();
  const pathname = usePathname();
  const search = useSearchParams();
  const nbtTab = search.get("tab");

  const s = (k: string) => (t as unknown as Record<string, string>)[k] ?? k;
  const isJson = (path: string, tab: string | null, want: string | null) =>
    path === "/json" && (want === null ? tab !== "nbt" : tab === want);

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: s("workspace"),
      items: [
        { href: "/", icon: LayoutDashboard, label: s("home"), match: (p) => p === "/" },
        { href: "/projects", icon: FolderKanban, label: s("projects"), match: (p) => p === "/projects" },
      ],
    },
    {
      title: s("create"),
      items: [
        { href: "/resource-pack", icon: Package, label: s("resourcePack"), match: (p) => p === "/resource-pack" },
        { href: "/skin", icon: PersonStanding, label: s("skinStudio"), match: (p) => p === "/skin" },
        { href: "/pixel-art", icon: Grid3x3, label: s("pixelArt"), match: (p) => p === "/pixel-art" },
        { href: "/model", icon: Box, label: s("modelStudio"), match: (p) => p === "/model" },
        { href: "/textures", icon: ImageIcon, label: s("textureTools"), match: (p) => p === "/textures" },
      ],
    },
    {
      title: s("tools"),
      items: [
        { href: "/profile", icon: UserSearch, label: s("profile"), match: (p) => p === "/profile" },
        { href: "/server", icon: Server, label: s("serverTools"), match: (p) => p === "/server" },
        { href: "/commands", icon: TerminalSquare, label: s("commands"), match: (p) => p === "/commands" },
        { href: "/json", icon: Braces, label: s("json"), match: (p, tab) => isJson(p, tab, null) },
        { href: "/json?tab=nbt", icon: Database, label: s("nbt"), match: (p, tab) => isJson(p, tab, "nbt") },
      ],
    },
    {
      title: s("utility"),
      items: [
        { href: "/validator", icon: ShieldCheck, label: s("validator"), match: (p) => p === "/validator" },
        { href: "/optimizer", icon: Gauge, label: s("optimizer"), match: (p) => p === "/optimizer" },
        { href: "/versions", icon: Tags, label: s("versionTools"), match: (p) => p === "/versions" },
      ],
    },
    {
      title: "",
      items: [
        { href: "/settings", icon: SettingsIcon, label: s("settings"), match: (p) => p === "/settings" },
      ],
    },
  ];

  const renderItem = (n: NavItem) => {
    const active = n.match(pathname, nbtTab);
    const Icon = n.icon;
    const link = (
      <Link
        href={n.href}
        onClick={() => setSidebarOpen(false)}
        aria-current={active ? "page" : undefined}
        title={collapsed ? undefined : n.label}
        className="file-row ui-transition relative flex items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px]"
        data-active={active}
        style={{
          color: active ? "var(--text)" : "var(--muted)",
          fontWeight: active ? 650 : 400,
          background: !collapsed && active ? "var(--panel-2)" : "transparent",
        }}
      >
        <Icon
          className="size-[17px] shrink-0"
          aria-hidden
          style={{ color: active ? "var(--accent)" : undefined }}
        />
        {!collapsed && <span className="truncate">{n.label}</span>}
      </Link>
    );
    if (collapsed) {
      return (
        <Tip key={n.href} label={n.label}>
          {link}
        </Tip>
      );
    }
    return <span key={n.href} className="block">{link}</span>;
  };

  const body = (isDrawer: boolean) => (
    <nav
      aria-label="Main"
      className="flex h-full flex-col"
      style={{ background: "var(--panel)", width: collapsed && !isDrawer ? 56 : 232, transition: "width var(--t-fast)" }}
    >
      <div className={`flex items-center gap-2.5 px-3.5 pb-2.5 pt-3.5 ${collapsed && !isDrawer ? "justify-center px-0" : ""}`}>
        <span
          className="grid size-7 shrink-0 place-items-center rounded font-mono text-[13px] font-bold text-white"
          style={{ background: "var(--accent)" }}
          aria-hidden
        >
          <Cuboid className="size-4" />
        </span>
        {(!collapsed || isDrawer) && (
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-tight">{s("appName")}</div>
            <div className="text-[10.5px]" style={{ color: "var(--faint)" }}>{s("tagline")}</div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? "mt-2.5" : "mt-1"}>
            {g.title && (!collapsed || isDrawer) && (
              <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--faint)" }}>
                {g.title}
              </div>
            )}
            {g.title && collapsed && !isDrawer && gi > 0 && (
              <div className="mx-2.5 my-1.5 border-t" style={{ borderColor: "var(--border)" }} aria-hidden />
            )}
            <div className="flex flex-col gap-px">{g.items.map(renderItem)}</div>
          </div>
        ))}
      </div>
      <div className="border-t px-2 py-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? s("expandSidebar") : s("collapseSidebar")}
          title={collapsed ? s("expandSidebar") : s("collapseSidebar")}
          className="ui-transition flex w-full items-center gap-2.5 rounded px-2.5 py-[7px] text-[13px]"
          style={{ color: "var(--muted)" }}
        >
          {collapsed ? (
            <span className="mx-auto">
              {lang === "ar" ? <ChevronsLeft className="size-[17px]" aria-hidden /> : <ChevronsRight className="size-[17px]" aria-hidden />}
            </span>
          ) : (
            <>
              {lang === "ar" ? <ChevronsRight className="size-[17px]" aria-hidden /> : <ChevronsLeft className="size-[17px]" aria-hidden />}
              <span className="truncate">{s("collapseSidebar")}</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className="sticky top-0 hidden h-screen shrink-0 border-e md:block"
        style={{ borderColor: "var(--border)" }}
      >
        {body(false)}
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/55" onClick={() => setSidebarOpen(false)} />
          <aside
            className="absolute bottom-0 start-0 top-0 w-72 border-e"
            style={{ background: "var(--panel)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="ui-transition absolute end-2 top-2 rounded p-1.5"
              style={{ color: "var(--muted)" }}
            >
              <X className="size-5" aria-hidden />
            </button>
            {body(true)}
          </aside>
        </div>
      )}
    </>
  );
}
