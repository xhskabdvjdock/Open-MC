"use client";
import { useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { useApp } from "@/components/Providers";
import { VANILLA_ITEMS, VANILLA_ENTITIES, VANILLA_EFFECTS, VANILLA_ENCHANTMENTS, GAMEMODES, WEATHERS, TIMES } from "@/lib/minecraft-data";
import { Btn, Field, inputCls, inputStyle, Tabs } from "@/components/ui";

type Tab = "give" | "summon" | "tp" | "effect" | "enchant" | "time" | "weather" | "gamemode";

export default function CommandsPage() {
  const { notify } = useApp();
  const [tab, setTab] = useState<Tab>("give");

  const [gPlayer, setGPlayer] = useState("@s");
  const [gItem, setGItem] = useState("minecraft:diamond_sword");
  const [gCount, setGCount] = useState(1);
  const [gEnch, setGEnch] = useState<{ id: string; lvl: number }[]>([{ id: "minecraft:sharpness", lvl: 5 }]);

  const [sEntity, setSEntity] = useState("minecraft:zombie");
  const [sPos, setSPos] = useState("~ ~ ~");
  const [sName, setSName] = useState("");

  const [tpTarget, setTpTarget] = useState("@s");
  const [tpDest, setTpDest] = useState("0 100 0");

  const [ePlayer, setEPlayer] = useState("@s");
  const [eEffect, setEEffect] = useState("minecraft:speed");
  const [eDur, setEDur] = useState(30);
  const [eAmp, setEAmp] = useState(1);

  const [nPlayer, setNPlayer] = useState("@s");
  const [nEnch, setNEnch] = useState("minecraft:sharpness");
  const [nLvl, setNLvl] = useState(5);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
      <div className="overflow-x-auto px-2 pt-1.5">
        <Tabs
          ariaLabel="Command type"
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "give", label: <code>give</code> },
            { id: "summon", label: <code>summon</code> },
            { id: "tp", label: <code>tp</code> },
            { id: "effect", label: <code>effect</code> },
            { id: "enchant", label: <code>enchant</code> },
            { id: "time", label: <code>time</code> },
            { id: "weather", label: <code>weather</code> },
            { id: "gamemode", label: <code>gamemode</code> },
          ]}
        />
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 overflow-y-auto p-4" aria-label="Options">
          <div className="mx-auto flex max-w-lg flex-col gap-3.5">
            {tab === "give" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Player / selector"><input value={gPlayer} onChange={(e) => setGPlayer(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
                  <Field label="Count (1–64)"><input type="number" min={1} max={64} value={gCount} onChange={(e) => setGCount(+e.target.value)} className={inputCls} style={inputStyle()} /></Field>
                </div>
                <Field label="Item">
                  <select value={gItem} onChange={(e) => setGItem(e.target.value)} className={inputCls} style={inputStyle()}>
                    {VANILLA_ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold">Enchantments <span className="font-normal" style={{ color: "var(--muted)" }}>(Java 1.20.5+ components)</span></p>
                  {gEnch.map((e, i) => (
                    <div key={i} className="mb-1.5 flex items-center gap-1.5">
                      <select value={e.id} onChange={(ev) => setGEnch(gEnch.map((x, k) => k === i ? { ...x, id: ev.target.value } : x))} className={`${inputCls} flex-1`} style={inputStyle()}>
                        {VANILLA_ENCHANTMENTS.map((v) => <option key={v.id} value={v.id}>{v.id} (max {v.max})</option>)}
                      </select>
                      <input type="number" min={1} max={255} value={e.lvl} onChange={(ev) => setGEnch(gEnch.map((x, k) => k === i ? { ...x, lvl: +ev.target.value } : x))} aria-label="Level" className={inputCls} style={{ ...inputStyle(), width: 72 }} />
                      <button onClick={() => setGEnch(gEnch.filter((_, k) => k !== i))} aria-label="Remove enchantment" className="ui-transition rounded border px-2 py-[7px] hover:opacity-70" style={{ borderColor: "var(--border)", color: "var(--danger)" }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => setGEnch([...gEnch, { id: "minecraft:unbreaking", lvl: 3 }])} className="ui-transition rounded border px-2.5 py-1 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)" }}>+ Add enchantment</button>
                </div>
              </>
            )}
            {tab === "summon" && (
              <>
                <Field label="Entity">
                  <select value={sEntity} onChange={(e) => setSEntity(e.target.value)} className={inputCls} style={inputStyle()}>
                    {VANILLA_ENTITIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Position (x y z, ~ allowed)"><input value={sPos} onChange={(e) => setSPos(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
                <Field label="Custom name (optional)"><input value={sName} onChange={(e) => setSName(e.target.value)} className={inputCls} style={inputStyle()} placeholder="Bob" /></Field>
              </>
            )}
            {tab === "tp" && (
              <>
                <Field label="Target"><input value={tpTarget} onChange={(e) => setTpTarget(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
                <Field label="Destination (player or x y z)"><input value={tpDest} onChange={(e) => setTpDest(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
              </>
            )}
            {tab === "effect" && (
              <>
                <Field label="Player"><input value={ePlayer} onChange={(e) => setEPlayer(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
                <Field label="Effect">
                  <select value={eEffect} onChange={(e) => setEEffect(e.target.value)} className={inputCls} style={inputStyle()}>
                    {VANILLA_EFFECTS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Duration (s)"><input type="number" min={1} value={eDur} onChange={(e) => setEDur(+e.target.value)} className={inputCls} style={inputStyle()} /></Field>
                  <Field label="Amplifier (0 = I)"><input type="number" min={0} max={255} value={eAmp} onChange={(e) => setEAmp(+e.target.value)} className={inputCls} style={inputStyle()} /></Field>
                </div>
              </>
            )}
            {tab === "enchant" && (
              <>
                <Field label="Player"><input value={nPlayer} onChange={(e) => setNPlayer(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
                <Field label="Enchantment">
                  <select value={nEnch} onChange={(e) => setNEnch(e.target.value)} className={inputCls} style={inputStyle()}>
                    {VANILLA_ENCHANTMENTS.map((v) => <option key={v.id} value={v.id}>{v.id} (max {v.max})</option>)}
                  </select>
                </Field>
                <Field label="Level"><input type="number" min={1} max={255} value={nLvl} onChange={(e) => setNLvl(+e.target.value)} className={inputCls} style={inputStyle()} /></Field>
                <p className="text-[12px]" style={{ color: "var(--muted)" }}>Applies to the item the player is holding — that&apos;s how vanilla <code>/enchant</code> works.</p>
              </>
            )}
            {tab === "time" && (
              <Field label="Time">
                <select value={timeVal} onChange={(e) => setTimeVal(e.target.value)} className={inputCls} style={inputStyle()}>
                  <option value="day">day</option>
                  <option value="night">night</option>
                  <option value="noon">noon</option>
                  <option value="midnight">midnight</option>
                  {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            )}
            {tab === "weather" && (
              <>
                <Field label="Weather">
                  <select value={weather} onChange={(e) => setWeather(e.target.value)} className={inputCls} style={inputStyle()}>
                    {WEATHERS.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </Field>
                <Field label="Duration (s)"><input type="number" min={1} value={wDur} onChange={(e) => setWDur(+e.target.value)} className={inputCls} style={inputStyle()} /></Field>
              </>
            )}
            {tab === "gamemode" && (
              <>
                <Field label="Mode">
                  <select value={gm} onChange={(e) => setGm(e.target.value)} className={inputCls} style={inputStyle()}>
                    {GAMEMODES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Player"><input value={gmPlayer} onChange={(e) => setGmPlayer(e.target.value)} className={inputCls} style={inputStyle()} spellCheck={false} /></Field>
              </>
            )}
          </div>
        </div>
        <aside className="flex flex-col gap-2 border-t p-4 lg:border-s lg:border-t-0" style={{ borderColor: "var(--border)", background: "var(--panel-2)" }} aria-label="Output">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>Generated command · live</h2>
          <code className="block break-all rounded border p-3 font-mono text-[13px] leading-relaxed" style={{ borderColor: "var(--border)", background: "#10151b", color: "#7ee2a8" }}>/{command}</code>
          <Btn primary onClick={copy}>
            <Copy className="size-4" aria-hidden /> Copy
          </Btn>
          <p className="text-[12px]" style={{ color: "var(--muted)" }}>Paste into chat (cheats on) or a command block. Selectors like <code>@s</code>/<code>@p</code> work as usual.</p>
        </aside>
      </div>
    </div>
  );
}
