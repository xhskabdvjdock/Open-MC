import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export const metadata: Metadata = {
  title: "Open MC — Minecraft Toolkit",
  description: "All-in-one local-first Minecraft toolkit: resource packs, skins, textures, models, commands, servers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>
          <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-5">{children}</main>
              <footer className="border-t border-slate-200 px-5 py-3 text-[11.5px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                Open MC · local-first toolkit · files stay on your device unless a tool is labeled “Requires network”
              </footer>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
