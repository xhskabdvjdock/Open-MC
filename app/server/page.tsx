"use client";
import { useCallback, useMemo, useState } from "react";
import { Server, Copy, Download, ImagePlus } from "lucide-react";
import { useApp } from "@/components/Providers";
import { motdToHtml, MOTD_COLOR_BUTTONS } from "@/lib/motd";
import { loadImage, downloadBlob } from "@/lib/pixel-utils";

interface ServerInfo {
  online: boolean;
  host: string;
  version?: string;
  bedrock?: boolean;
  players?: { online: number; max: number; list?: { name: string }[] };
  motd?: { raw?: string[]; clean?: string[] };
  icon?: string | null;
  latencyMs?: number;
  software?: string | null;
}

export default function ServerPage() {
  const { notify } = useApp();
  const [host, setHost] = useState("");
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // MOTD editor
  const [motd, setMotd] = useState("§6Welcome to §lMy Server§r\n§7play.example.com");
  const motdHtml = useMemo(() => motdToHtml(motd), [motd]);

  // icon tool
  const [iconUrl, setIconUrl] = useState("");
  const [iconOk, setIconOk] = useState<boolean | null>(null);

  const query = useCallback(async () => {
    const h = host.trim();
    if (!h) { setError("Enter a server address first. Example: play.example.com"); return; }
    setBusy(true);
    setError("");
    setInfo(null);
    try {
      const r = await fetch(`/api/server?host=${encodeURIComponent(h)}`);
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "Query failed."); return; }
      setInfo(j);
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setBusy(false);
    }
  }, [host]);

  const copy = useCallback(async (t: string) => {
    try { await navigator.clipboard.writeText(t); notify("Copied"); }
    catch { notify("Copy failed.", "err"); }
  }, [notify]);

  const onIconFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const img = await loadImage(f);
      const c = document.createElement("canvas");
      c.width = 64; c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      // cover-crop to square then downscale
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 64, 64);
      setIconUrl(c.toDataURL("image/png"));
      setIconOk(true);
      notify("Icon resized to 64×64");
    } catch { notify("Could not decode image.", "err"); }
  }, [notify]);

  const exportIcon = useCallback(async () => {
    if (!iconUrl) { notify("Create an icon first.", "err"); return; }
    const img = await loadImage(iconUrl);
    if (img.naturalWidth !== 64 || img.naturalHeight !== 64) {
      setIconOk(false);
      notify("Icon must be exactly 64×64.", "err");
      return;
    }
    const r = await fetch(iconUrl);
    const blob = await r.blob();
    downloadBlob(blob, "server-icon.png");
    notify("Exported — place as server-icon.png next to server.properties");
  }, [iconUrl, notify]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><Server className="size-5 text-emerald-600" aria-hidden /> Server Tools</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Live Java/Bedrock status via a public API (proxied server-side). Offline is reported as offline — never guessed. <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[11px]">Requires network</span></p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); query(); }} className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-end dark:border-slate-700 dark:bg-slate-900">
        <label className="flex-1 text-[13px] font-semibold">
          Server address
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="play.example.com" spellCheck={false} autoComplete="off" aria-label="Server address" className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 font-mono dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <button type="submit" disabled={busy} className="rounded-md bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Querying…" : "Query"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

      {info && (
        <section aria-label="Server result" className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-1 text-[12.5px] font-bold ${info.online ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : "bg-red-600/10 text-red-700 dark:text-red-300"}`}>
              {info.online ? "Online" : "Offline"}
            </span>
            <code className="font-mono text-[13px] font-bold">{info.host}</code>
            {info.online && info.bedrock !== undefined && (
              <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11.5px] dark:border-slate-700">{info.bedrock ? "Bedrock" : "Java"}</span>
            )}
            {info.online && <span className="ms-auto text-[12px] text-slate-500">API response: {info.latencyMs} ms (not in-game ping)</span>}
          </div>
          {info.online && (
            <dl className="mt-3 grid gap-1.5 text-[13px] sm:grid-cols-2">
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-slate-500">Players</dt><dd className="font-mono font-bold">{info.players?.online} / {info.players?.max}</dd></div>
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-slate-500">Version</dt><dd className="font-mono">{info.version ?? "unknown"}</dd></div>
              {info.software && <div className="flex gap-2"><dt className="w-24 shrink-0 text-slate-500">Software</dt><dd className="font-mono">{info.software}</dd></div>}
              <div className="flex gap-2"><dt className="w-24 shrink-0 text-slate-500">MOTD</dt><dd className="font-mono break-all">{info.motd?.clean?.join(" ⏎ ") ?? "—"}</dd></div>
            </dl>
          )}
          {info.online && info.icon && (
            <div className="mt-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.icon} alt="Server icon" width={64} height={64} className="rounded" style={{ imageRendering: "pixelated" }} />
              <span className="text-[12px] text-slate-500">Live server icon (64×64).</span>
            </div>
          )}
          {!info.online && <p className="mt-2 text-[13px] text-slate-500">The query returned offline. The server may be down, blocking queries, or the address is wrong.</p>}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="MOTD editor" className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1.5 text-[14px] font-bold">MOTD editor + live preview</h2>
          <div className="mb-1.5 flex flex-wrap gap-1" role="toolbar" aria-label="MOTD colors">
            {MOTD_COLOR_BUTTONS.slice(0, 16).map(({ code, hex }) => (
              <button key={code} onClick={() => setMotd((m) => m + `§${code}`)} title={`§${code}`} aria-label={`Insert color code ${code}`} className="size-6 rounded-sm border border-black/25" style={{ background: hex }} />
            ))}
            <button onClick={() => setMotd((m) => m + "§l")} title="Bold (§l)" className="rounded border border-slate-200 px-1.5 text-[12px] font-bold dark:border-slate-700">B</button>
            <button onClick={() => setMotd((m) => m + "§r")} title="Reset (§r)" className="rounded border border-slate-200 px-1.5 text-[12px] dark:border-slate-700">R</button>
          </div>
          <textarea value={motd} onChange={(e) => setMotd(e.target.value)} rows={4} spellCheck={false} aria-label="MOTD with formatting codes" className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12.5px] dark:border-slate-700 dark:bg-slate-950" />
          <div className="mt-2 rounded-md bg-[#100d0d] p-3" aria-label="MOTD preview">
            <p className="mb-1 text-[10.5px] uppercase tracking-wider text-slate-400">In-game preview (approx)</p>
            <div dangerouslySetInnerHTML={{ __html: motdHtml }} className="font-mono text-[14px] leading-snug" style={{ fontFamily: "monospace" }} />
          </div>
          <button onClick={() => copy(motd)} className="mt-2 flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-semibold hover:border-emerald-500 dark:border-slate-700">
            <Copy className="size-3.5" aria-hidden /> Copy MOTD
          </button>
        </section>

        <section aria-label="Server icon tool" className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-bold"><ImagePlus className="size-4" aria-hidden /> Server icon (server-icon.png)</h2>
          <p className="mb-2 text-[12.5px] text-slate-500">Java Edition requires exactly <span className="font-mono font-bold">64×64 PNG</span>. This tool cover-crops and resizes locally.</p>
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-5 text-[13px] font-semibold hover:border-emerald-500 dark:border-slate-700">
            Upload image…
            <input type="file" accept="image/*" className="hidden" onChange={onIconFile} />
          </label>
          {iconUrl && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl} alt="Server icon preview 64 by 64" width={64} height={64} style={{ imageRendering: "pixelated" }} className="rounded border border-slate-200 dark:border-slate-700" />
              <div className="text-[12.5px]">
                <p className={iconOk ? "text-emerald-600" : "text-red-600"}>{iconOk ? "Valid: 64×64 PNG." : "Invalid size."}</p>
                <button onClick={exportIcon} className="mt-1 flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700">
                  <Download className="size-3.5" aria-hidden /> Export server-icon.png
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
