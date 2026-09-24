"use client";
import { useCallback, useState } from "react";
import { Copy, Download } from "lucide-react";
import { useApp } from "@/components/Providers";
import { Btn, EmptyState, inputCls, inputStyle } from "@/components/ui";

interface Profile {
  username: string;
  uuid: string;
  uuidTrimmed: string;
  avatar: string;
  skin: string;
  render: string;
  cape: string | null;
}

export default function ProfilePage() {
  const { notify } = useApp();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uuidIn, setUuidIn] = useState("");
  const [uuidOut, setUuidOut] = useState("");

  const search = useCallback(async () => {
    const q = name.trim();
    if (!q) { setError("Enter a Minecraft username first."); return; }
    setBusy(true);
    setError("");
    setProfile(null);
    try {
      const r = await fetch(`/api/profile/${encodeURIComponent(q)}`);
      const j = await r.json();
      if (!j.ok) {
        setError(j.error ?? "Lookup failed.");
        return;
      }
      setProfile(j);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }, [name]);

  const copy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copied`);
    } catch { notify("Copy failed.", "err"); }
  }, [notify]);

  const formatUuid = useCallback(() => {
    const h = uuidIn.replace(/-/g, "").toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(h)) {
      setUuidOut("Invalid UUID — expected 32 hex characters.");
      return;
    }
    const dashed = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    setUuidOut(uuidIn.includes("-") ? h : dashed);
  }, [uuidIn]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <form
        onSubmit={(e) => { e.preventDefault(); search(); }}
        className="flex gap-1.5"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Username — e.g. Notch"
          maxLength={36}
          spellCheck={false}
          autoComplete="off"
          aria-label="Minecraft username or UUID"
          className={`${inputCls} font-mono`}
          style={inputStyle()}
        />
        <Btn primary type="submit" disabled={busy}>{busy ? "…" : "Search"}</Btn>
      </form>
      <p className="-mt-2 text-[12px]" style={{ color: "var(--faint)" }}>
        Real lookups via public APIs (proxied + cached). UUIDs work in the same box. <span className="rounded border px-1" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>Requires network</span>
      </p>

      {error && <p role="alert" className="rounded border px-3 py-2 text-[13px]" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>{error}</p>}

      {!profile && !error && (
        <div style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)" }}>
          <EmptyState title="Look up a player" body="Skin preview, UUID, cape status — straight from Mojang's records." />
        </div>
      )}

      {profile && (
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div className="flex flex-row items-start justify-center gap-3 sm:flex-col sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.render} alt={`3D render of ${profile.username}`} className="h-52 w-auto" style={{ imageRendering: "pixelated" }} onError={(e) => { (e.target as HTMLImageElement).src = profile.avatar; }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatar} alt={`Head avatar of ${profile.username}`} width={48} height={48} className="rounded-sm" style={{ imageRendering: "pixelated" }} />
          </div>
          <div className="flex min-w-0 flex-col gap-2.5">
            <h2 className="text-[19px] font-bold tracking-tight">{profile.username}</h2>
            <KV label="UUID" value={profile.uuid} onCopy={() => copy(profile.uuid, "UUID")} />
            <KV label="Trimmed" value={profile.uuidTrimmed} onCopy={() => copy(profile.uuidTrimmed, "UUID")} />
            <KV label="Cape" value={profile.cape ?? "none on record"} onCopy={profile.cape ? () => copy(profile.cape!, "Cape URL") : undefined} link={profile.cape} />
            <div className="mt-1 flex flex-wrap gap-1.5">
              <a href={profile.skin} target="_blank" rel="noreferrer" className="ui-transition flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)" }}>
                <Download className="size-3.5" aria-hidden /> Skin PNG
              </a>
              <button onClick={() => copy(profile.skin, "Skin URL")} className="ui-transition flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)" }}>
                <Copy className="size-3.5" aria-hidden /> Skin URL
              </button>
            </div>
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              Skin shown live from Mojang/Crafatar. Not every account has a cape — none is invented here.
            </p>
          </div>
        </div>
      )}

      <section aria-label="UUID formatter" className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <h2 className="mb-1.5 font-mono text-[12px] font-bold" style={{ color: "var(--muted)" }}>UUID FORMATTER</h2>
        <div className="flex gap-1.5">
          <input
            value={uuidIn}
            onChange={(e) => setUuidIn(e.target.value)}
            placeholder="069a79f444e94726cc5de7e9b8a13e12"
            spellCheck={false}
            aria-label="UUID to format"
            className={`${inputCls} font-mono text-[12.5px]`}
            style={inputStyle()}
          />
          <Btn onClick={formatUuid}>Format</Btn>
        </div>
        {uuidOut && <p className="mt-1.5 font-mono text-[12.5px] break-all">{uuidOut}</p>}
      </section>
    </div>
  );
}

function KV({ label, value, onCopy, link }: { label: string; value: string; onCopy?: () => void; link?: string | null }) {
  const body = link ? (
    <a href={link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-[12.5px] underline" style={{ color: "var(--accent)" }}>{value}</a>
  ) : (
    <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{value}</code>
  );
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 text-[12.5px]" style={{ color: "var(--muted)" }}>{label}</span>
      {body}
      {onCopy && (
        <button onClick={onCopy} aria-label={`Copy ${label}`} title={`Copy ${label}`} className="ui-transition rounded p-1.5" style={{ color: "var(--muted)" }}>
          <Copy className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
