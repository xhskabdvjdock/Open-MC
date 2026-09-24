"use client";
import { useCallback, useMemo, useState } from "react";
import { Copy, Download } from "lucide-react";
import { useApp } from "@/components/Providers";
import { motdToHtml, MOTD_COLOR_BUTTONS } from "@/lib/motd";
import { loadImage, downloadBlob } from "@/lib/pixel-utils";
import { Btn, Panel, inputCls, inputStyle } from "@/components/ui";

interface ServerInfo {
  online: boolean;
  host: string;
  version?: string;
  bedrock?: boolean;
  players?: { online: number; max: number };
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

  const [motd, setMotd] = useState("§6Welcome to §lMy Server§r\n§7play.example.com");
  const motdHtml = useMemo(() => motdToHtml(motd), [motd]);

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); query(); }} className="flex gap-1.5">
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="play.example.com"
          spellCheck={false}
          autoComplete="off"
          aria-label="Server address"
          className={`${inputCls} font-mono`}
          style={inputStyle()}
        />
        <Btn primary type="submit" disabled={busy}>{busy ? "…" : "Check"}</Btn>
      </form>

      {error && <p role="alert" className="rounded border px-3 py-2 text-[13px]" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</p>}

      {info && (
        <section aria-label="Server status">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-2 py-[3px] text-[12.5px] font-bold" style={{ background: info.online ? "var(--accent-soft)" : "transparent", border: `1px solid ${info.online ? "var(--accent)" : "var(--danger)"}`, color: info.online ? "var(--accent)" : "var(--danger)" }}>
              {info.online ? "Online" : "Offline"}
            </span>
            <code className="font-mono text-[14px] font-bold">{info.host}</code>
            {info.online && info.bedrock !== undefined && (
              <span className="rounded border px-1.5 py-px font-mono text-[11px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{info.bedrock ? "Bedrock" : "Java"}</span>
            )}
            {info.online && <span className="ms-auto font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>api: {info.latencyMs} ms (not in-game ping)</span>}
          </div>
          {info.online ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
              <Stat label="Players" value={`${info.players?.online} / ${info.players?.max}`} mono />
              <Stat label="Version" value={info.version ?? "unknown"} mono />
              {info.software && <Stat label="Software" value={info.software} mono />}
              <div className="col-span-full flex gap-2.5">
                <dt className="shrink-0" style={{ color: "var(--muted)" }}>MOTD</dt>
                <dd className="min-w-0 font-mono text-[12.5px] break-all">{info.motd?.clean?.join(" ⏎ ") ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>Offline — the server may be down, blocking queries, or the address is wrong.</p>
          )}
          {info.online && info.icon && (
            <div className="mt-2.5 flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.icon} alt="Server icon" width={48} height={48} className="rounded-sm" style={{ imageRendering: "pixelated" }} />
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>Live server icon.</span>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="MOTD editor">
          <div className="mb-1.5 flex flex-wrap gap-1" role="toolbar" aria-label="MOTD colors">
            {MOTD_COLOR_BUTTONS.slice(0, 16).map(({ code, hex }) => (
              <button key={code} onClick={() => setMotd((m) => m + `§${code}`)} title={`§${code}`} aria-label={`Insert color code ${code}`} className="size-6 rounded-sm border border-black/25" style={{ background: hex }} />
            ))}
            <button onClick={() => setMotd((m) => m + "§l")} title="Bold (§l)" className="rounded border px-1.5 text-[12px] font-bold" style={{ borderColor: "var(--border)" }}>B</button>
            <button onClick={() => setMotd((m) => m + "§r")} title="Reset (§r)" className="rounded border px-1.5 text-[12px]" style={{ borderColor: "var(--border)" }}>R</button>
          </div>
          <textarea value={motd} onChange={(e) => setMotd(e.target.value)} rows={3} spellCheck={false} aria-label="MOTD with formatting codes" className="w-full rounded border p-2 font-mono text-[12.5px] outline-none" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }} />
          <div className="mt-2 rounded bg-[#100d0d] p-3" aria-label="MOTD preview">
            <div dangerouslySetInnerHTML={{ __html: motdHtml }} className="font-mono text-[13.5px] leading-snug" />
          </div>
          <div className="mt-2">
            <Btn onClick={() => copy(motd)}><Copy className="size-3.5" aria-hidden /> Copy MOTD</Btn>
          </div>
        </Panel>

        <Panel title="server-icon.png · 64×64">
          <p className="mb-2 text-[12.5px]" style={{ color: "var(--muted)" }}>Java requires exactly 64×64 PNG. Cover-cropped + resized locally.</p>
          <label className="ui-transition flex cursor-pointer items-center justify-center rounded border border-dashed px-3 py-4 text-[13px] font-semibold" style={{ borderColor: "var(--border-strong)" }}>
            Upload image…
            <input type="file" accept="image/*" className="hidden" onChange={onIconFile} />
          </label>
          {iconUrl && (
            <div className="mt-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconUrl} alt="Server icon preview 64 by 64" width={48} height={48} style={{ imageRendering: "pixelated" }} className="rounded-sm border" />
              <div className="text-[12.5px]">
                <p style={{ color: iconOk ? "var(--accent)" : "var(--danger)" }}>{iconOk ? "Valid: 64×64 PNG." : "Invalid size."}</p>
                <div className="mt-1">
                  <Btn primary onClick={exportIcon}><Download className="size-3.5" aria-hidden /> Export</Btn>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2.5">
      <dt className="shrink-0" style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className={`min-w-0 truncate font-bold ${mono ? "font-mono text-[12.5px]" : ""}`}>{value}</dd>
    </div>
  );
}
