import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { CommandPalette } from "@/components/CommandPalette";
import { NewProjectDialog } from "@/components/NewProjectDialog";

export const metadata: Metadata = {
  title: "Open MC — Minecraft Toolkit",
  description: "All-in-one local-first Minecraft toolkit: resource packs, skins, textures, models, commands, servers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>
          <div className="flex min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
            <Suspense>
              <Sidebar />
            </Suspense>
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-3 py-4 sm:px-4">
                {children}
              </main>
            </div>
          </div>
          <CommandPalette />
          <NewProjectDialog />
        </Providers>
      </body>
    </html>
  );
}
