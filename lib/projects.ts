import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ProjectRecord } from "./storage";

export function openSavedProject(
  p: ProjectRecord,
  router: AppRouterInstance,
  notify: (m: string, k?: "ok" | "err" | "info") => void
): void {
  const routes: Record<string, string> = {
    "resource-pack": "/resource-pack",
    skin: "/skin",
    "pixel-art": "/pixel-art",
  };
  const href = routes[p.kind];
  if (!href || typeof p.data !== "object") {
    notify("This project can only be downloaded, not reopened.", "info");
    return;
  }
  try {
    sessionStorage.setItem("openmc-open-project", JSON.stringify({ id: p.id, kind: p.kind }));
  } catch { /* ignore */ }
  router.push(href);
}

export function consumeOpenProject(kind: string): string | null {
  try {
    const raw = sessionStorage.getItem("openmc-open-project");
    if (!raw) return null;
    const seed = JSON.parse(raw) as { id: string; kind: string };
    if (seed.kind !== kind) return null;
    sessionStorage.removeItem("openmc-open-project");
    return seed.id;
  } catch {
    return null;
  }
}
