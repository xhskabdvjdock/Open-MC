"use client";
import { useMemo, useState } from "react";
import { TerminalSquare, Copy } from "lucide-react";
import { useApp } from "@/components/Providers";
import { VANILLA_ITEMS, VANILLA_ENTITIES, VANILLA_EFFECTS, VANILLA_ENCHANTMENTS, GAMEMODES, WEATHERS, TIMES } from "@/lib/minecraft-data";

type Tab = "give" | "summon" | "tp" | "effect" | "enchant" | "time" | "weather" | "gamemode";

export default function CommandsPage() {
  const { notify } = useApp();
  const [tab, setTab] = useState<Tab>("give");

  // give
  const [gPlayer, setGPlayer] = useState("@s");
  const [gItem, setGItem] = useState("minecraft:diamond_sword");
  const [gCount, setGCount] = useState(1);
  const [gEnch, setGEnch] = useState<{ id: string; lvl: number }[]>([{ id: "minecraft:sharpness", lvl: 5 }]);

  // summon
  const [sEntity, setSEntity] = useState("minecraft:zombie");
  const [sPos, setSPos] = useState("~ ~ ~");
  const [sName, setSName] = useState("");

  // tp
  const [tpTarget, setTpTarget] = useState("@s");
  const [tpDest, setTpDest] = useState("0 100 0");

  // effect
  const [ePlayer, setEPlayer] = useState("@s");
  const [eEffect, setEEffect] = useState("minecraft:speed");
  const [eDur, setEDur] = useState(30);
  const [eAmp, setEAmp] = useState(1);

  // enchant
  const [nPlayer, setNPlayer] = useState("@s");
  const [nEnch, setNEnch] = useState("minecraft:sharpness");
  const [nLvl, setNLvl] = useState(5);

  // time/weather/gamemode
  const [timeVal, setTimeVal] = useState("1000");
  const [weather, setWeather] = useState("clear");
  const [wDur, setWDur] = useState(600);
  const [gm, setGm] = useState("creative");
  const [gmPlayer, setGmPlayer] = useState("@s");

  const command = useMemo(() => {
    switch (tab) {
      case "give": {
        const count = Math.max(1, Math.min(64, Math.floor(gCount) || 1));
        if (gEnch.length === 0) return `give ${gPlayer || "@s"} ${gItem} ${count}`;
        const levels = gEnch.map((e) => `"${e.id}":${Math.max(1, e.lvl)}`).join(",");
        return `give ${gPlayer || "@s"} ${gItem}[enchantments={levels:{${levels}}}] ${count}`;
      }
      case "summon": {
        const nameTag = sName.trim() ? `,CustomName:'"${sName.trim().replace(/'/g, "")}"'` : "";
        const nbt = nameTag ? `{${nameTag.slice(1)}} ` : "";
        return `summon ${sEntity} ${sPos || "~ ~ ~"} ${nbt}`.trim();
      }
      case "tp": return `tp ${tpTarget || "@s"} ${tpDest || "0 100 0"}`;
      case "effect": return `effect give ${ePlayer || "@s"} ${eEffect} ${Math.max(1, eDur)} ${Math.max(0, eAmp)}`;
      case "enchant": return `enchant ${nPlayer || "@s"} ${nEnch} ${Math.max(1, nLvl)}`;
      case "time": return `time set ${timeVal}`;
      case "weather": return `weather ${weather} ${Math.max(1, wDur)}`;
      case "gamemode": return `gamemode ${gm} ${gmPlayer || "@s"}`;
    }
  }, [tab, gPlayer, gItem, gCount, gEnch, sEntity, sPos, sName, tpTarget, tpDest, ePlayer, eEffect, eDur, eAmp, nPlayer, nEnch, nLvl, timeVal, weather, wDur, gm, gmPlayer]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(command); notify("Copied"); }
    catch { notify("Copy failed.", "err"); }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "give", label: "/give" }, { id: "summon", label: "/summon" }, { id: "tp", label: "/tp" },
    { id: "effect", label: "/effect" }, { id: "enchant", label: "/enchant" },
    { id: "time", label: "/time" }, { id: "weather", label: "/weather" }, { id: "gamemode", label: "/gamemode" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold tracking-tight"><TerminalSquare className="size-5 text-emerald-600" aria-hidden /> Command Generator</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">Pick options — Open MC writes valid Java Edition syntax. Enchanted <code>/give</code> uses 1.20.5+ components; plain commands work on older versions too. <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-slate-700">Local</span></p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Command type">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`rounded-md border px-3 py-1.5 font-mono text-[13px] ${tab === t.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 hover:border-emerald-500 dark:border-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="Options">
          {tab === "give" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Player / selector"><input value={gPlayer} onChange={(e) => setGPlayer(e.target.value)} className={inp} spellCheck={false} /></Field>
              <Field label="Item">
                <select value={gItem} onChange={(e) => setGItem(e.target.value)} className={inp}>
                  {VANILLA_ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Count (1–64)"><input type="number" min={1} max={64} value={gCount} onChange={(e) => setGCount(+e.target.value)} className={inp} /></Field>
              <div>
                <p className="mb-1 font-semibold">Enchantments (Java 1.20.5+ components)</p>
                {gEnch.map((e, i) => (
                  <div key={i} className="mb-1.5 flex items-center gap-1.5">
                    <select value={e.id} onChange={(ev) => setGEnch(gEnch.map((x, k) => k === i ? { ...x, id: ev.target.value } : x))} className={`${inp} flex-1`}>
                      {VANILLA_ENCHANTMENTS.map((v) => <option key={v.id} value={v.id}>{v.id} (max {v.max})</option>)}
                    </select>
                    <input type="number" min={1} max={255} value={e.lvl} onChange={(ev) => setGEnch(gEnch.map((x, k) => k === i ? { ...x, lvl: +ev.target.value } : x))} aria-label="Level" className={`${inp} w-20`} />
                    <button onClick={() => setGEnch(gEnch.filter((_, k) => k !== i))} aria-label="Remove enchantment" className="rounded border border-slate-200 px-2 py-1.5 hover:border-red-500 hover:text-red-600 dark:border-slate-700">×</button>
                  </div>
                ))}
                <button onClick={() => setGEnch([...gEnch, { id: "minecraft:unbreaking", lvl: 3 }])} className="rounded border border-slate-200 px-2.5 py-1 text-[12.5px] hover:border-emerald-500 dark:border-slate-700">+ Add enchantment</button>
                {gEnch.length > 0 && <p className="mt-1 text-[12px] text-slate-500">Levels above vanilla max still generate — the game may ignore or clamp them.</p>}
              </div>
            </div>
          )}
          {tab === "summon" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Entity">
                <select value={sEntity} onChange={(e) => setSEntity(e.target.value)} className={inp}>
                  {VANILLA_ENTITIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Position (x y z, ~ allowed)"><input value={sPos} onChange={(e) => setSPos(e.target.value)} className={inp} spellCheck={false} /></Field>
              <Field label="Custom name (optional)"><input value={sName} onChange={(e) => setSName(e.target.value)} className={inp} placeholder="Bob" /></Field>
            </div>
          )}
          {tab === "tp" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Target"><input value={tpTarget} onChange={(e) => setTpTarget(e.target.value)} className={inp} spellCheck={false} /></Field>
              <Field label="Destination (player or x y z)"><input value={tpDest} onChange={(e) => setTpDest(e.target.value)} className={inp} spellCheck={false} /></Field>
            </div>
          )}
          {tab === "effect" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Player"><input value={ePlayer} onChange={(e) => setEPlayer(e.target.value)} className={inp} spellCheck={false} /></Field>
              <Field label="Effect">
                <select value={eEffect} onChange={(e) => setEEffect(e.target.value)} className={inp}>
                  {VANILLA_EFFECTS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Duration (seconds)"><input type="number" min={1} value={eDur} onChange={(e) => setEDur(+e.target.value)} className={inp} /></Field>
              <Field label="Amplifier (0 = level I)"><input type="number" min={0} max={255} value={eAmp} onChange={(e) => setEAmp(+e.target.value)} className={inp} /></Field>
            </div>
          )}
          {tab === "enchant" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Player"><input value={nPlayer} onChange={(e) => setNPlayer(e.target.value)} className={inp} spellCheck={false} /></Field>
              <Field label="Enchantment">
                <select value={nEnch} onChange={(e) => setNEnch(e.target.value)} className={inp}>
                  {VANILLA_ENCHANTMENTS.map((v) => <option key={v.id} value={v.id}>{v.id} (max {v.max})</option>)}
                </select>
              </Field>
              <Field label="Level"><input type="number" min={1} max={255} value={nLvl} onChange={(e) => setNLvl(+e.target.value)} className={inp} /></Field>
              <p className="text-[12px] text-slate-500">Applies to the item the player is holding — that&apos;s how vanilla <code>/enchant</code> works.</p>
            </div>
          )}
          {tab === "time" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Time">
                <select value={timeVal} onChange={(e) => setTimeVal(e.target.value)} className={inp}>
                  <option value="day">day</option>
                  <option value="night">night</option>
                  <option value="noon">noon</option>
                  <option value="midnight">midnight</option>
                  {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>
          )}
          {tab === "weather" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Weather">
                <select value={weather} onChange={(e) => setWeather(e.target.value)} className={inp}>
                  {WEATHERS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </Field>
              <Field label="Duration (seconds)"><input type="number" min={1} value={wDur} onChange={(e) => setWDur(+e.target.value)} className={inp} /></Field>
            </div>
          )}
          {tab === "gamemode" && (
            <div className="flex flex-col gap-3 text-[13.5px]">
              <Field label="Mode">
                <select value={gm} onChange={(e) => setGm(e.target.value)} className={inp}>
                  {GAMEMODES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Player"><input value={gmPlayer} onChange={(e) => setGmPlayer(e.target.value)} className={inp} spellCheck={false} /></Field>
            </div>
          )}
        </section>

        <section className="h-fit rounded-md border border-slate-200 bg-white p-4 lg:sticky lg:top-16 dark:border-slate-700 dark:bg-slate-900" aria-label="Output">
          <h2 className="mb-1.5 text-[13px] font-bold">Output</h2>
          <code className="block break-all rounded-md bg-slate-950 p-3 font-mono text-[13px] text-emerald-300">/{command}</code>
          <button onClick={copy} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[13.5px] font-semibold text-white hover:bg-emerald-700">
            <Copy className="size-4" aria-hidden /> Copy
          </button>
          <p className="mt-2 text-[12px] text-slate-500">Paste into chat (cheats on) or a command block. Selectors like <code>@s</code>/<code>@p</code> work as usual.</p>
        </section>
      </div>
    </div>
  );
}

const inp = "mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[13.5px] font-semibold">
      {label}
      {children}
    </label>
  );
}
