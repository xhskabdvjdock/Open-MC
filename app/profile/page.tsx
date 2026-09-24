"use client";
import { useCallback, useState } from "react";
import { UserSearch, Copy, Download, Fingerprint } from "lucide-react";
import { useApp } from "@/components/Providers";

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
    setUuidOut(dashed.includes("-") && uuidIn.includes("-") ? h : dashed);
  }, [uuidIn]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><UserSearch className="size-5 text-emerald-600" aria-hidden /> Minecraft Profile</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Real lookups through public APIs (proxied + briefly cached server-side). Nothing is fabricated. <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[11px]">Requires network</span></p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); search(); }}
        className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-end dark:border-slate-700 dark:bg-slate-900"
      >
        <label className="flex-1 text-[13px] font-semibold">
          Username
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Notch"
            maxLength={32}
            spellCheck={false}
            autoComplete="off"
            aria-label="Minecraft username"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button type="submit" disabled={busy} className="rounded-md bg-emerald-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <p role="alert" className="rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

      {profile && (
        <section aria-label="Profile result" className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-[220px_1fr] dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.render} alt={`3D render of ${profile.username}`} className="h-56 w-auto" style={{ imageRendering: "pixelated" }} onError={(e) => { (e.target as HTMLImageElement).src = profile.avatar; }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatar} alt={`Head avatar of ${profile.username}`} width={64} height={64} className="rounded" style={{ imageRendering: "pixelated" }} />
          </div>
          <div className="flex min-w-0 flex-col gap-2 text-[13.5px]">
            <h2 className="text-[18px] font-bold">{profile.username}</h2>
            <KV label="UUID (dashed)" value={profile.uuid} onCopy={() => copy(profile.uuid, "UUID")} />
            <KV label="UUID (trimmed)" value={profile.uuidTrimmed} onCopy={() => copy(profile.uuidTrimmed, "UUID")} />
            <div className="flex flex-wrap gap-2">
              <a href={profile.skin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-semibold hover:border-emerald-500 dark:border-slate-700">
                <Download className="size-3.5" aria-hidden /> Download skin PNG
              </a>
              <button onClick={() => copy(profile.skin, "Skin URL")} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12.5px] font-semibold hover:border-emerald-500 dark:border-slate-700">
                <Copy className="size-3.5" aria-hidden /> Copy skin URL
              </button>
            </div>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              Current skin shown above (live from Mojang/Crafatar). Cape: {profile.cape ? <a href={profile.cape} target="_blank" rel="noreferrer" className="text-emerald-600 underline">view cape texture</a> : "none on record — not every account has one, and we don't invent one."}
            </p>
          </div>
        </section>
      )}

      <section aria-label="UUID tools" className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-2 flex items-center gap-1.5 text-[14px] font-bold"><Fingerprint className="size-4" aria-hidden /> UUID tools</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="text-[13px]">
            <p className="font-semibold">Username ⇄ UUID</p>
            <p className="mb-1.5 text-slate-500">Use the search above — it returns both formats from the real API. UUID→username works too: paste a UUID into the search box.</p>
          </div>
          <div className="text-[13px]">
            <label className="font-semibold" htmlFor="uuid-in">UUID formatter (add/remove dashes)</label>
            <div className="mt-1 flex gap-1.5">
              <input
                id="uuid-in"
                value={uuidIn}
                onChange={(e) => setUuidIn(e.target.value)}
                placeholder="069a79f444e94726cc5de7e9b8a13e12"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 font-mono text-[12.5px] dark:border-slate-700 dark:bg-slate-950"
              />
              <button onClick={formatUuid} className="rounded-md bg-slate-900 px-3 py-1.5 font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Format</button>
            </div>
            {uuidOut && <p className="mt-1.5 font-mono text-[12.5px] break-all">{uuidOut}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function KV({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-slate-500">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-[12.5px] dark:bg-slate-800">{value}</code>
      <button onClick={onCopy} aria-label={`Copy ${label}`} className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
        <Copy className="size-4" aria-hidden />
      </button>
    </div>
  );
}
