import { NextRequest, NextResponse } from "next/server";

// GET /api/profile/[username] — server-side proxy to public Minecraft APIs.
// Keeps secrets/keys off the client, adds short caching, normalizes errors.
// Primary: playerdb.co (free, no key). Fallback: Mojang session server by UUID.

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5 * 60 * 1000;

function isUuid(s: string): boolean {
  return /^[0-9a-f]{32}$/i.test(s.replace(/-/g, ""));
}
function normalizeUuid(s: string): string {
  const h = s.replace(/-/g, "").toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username: rawParam } = await ctx.params;
  const raw = decodeURIComponent(rawParam ?? "").trim();
  if (!raw || raw.length > 32 || !/^[A-Za-z0-9_\-]+$/.test(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid username. Use 3–16 characters: letters, numbers, underscore." }, { status: 400 });
  }
  const key = raw.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...(hit.data as object) });
  }
  try {
    // playerdb handles both usernames and UUIDs
    const r = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(raw)}`, {
      headers: { "User-Agent": "OpenMC/1.0" },
      next: { revalidate: 300 },
    });
    if (r.status === 404) {
      return NextResponse.json({ ok: false, error: "Player not found. Check the spelling." }, { status: 404 });
    }
    if (r.status === 429) {
      return NextResponse.json({ ok: false, error: "Rate limited by the profile API. Try again in a minute." }, { status: 429 });
    }
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "Profile API unavailable. Try again later." }, { status: 502 });
    }
    const j = await r.json();
    const p = j?.data?.player;
    if (!p?.username || !p?.id) {
      return NextResponse.json({ ok: false, error: "Player not found." }, { status: 404 });
    }
    const uuid = normalizeUuid(p.id);
    const data = {
      username: p.username as string,
      uuid,
      uuidTrimmed: (p.id as string).toLowerCase(),
      avatar: (p.avatar as string) ?? `https://crafatar.com/avatars/${p.id}?size=64&overlay`,
      skin: `https://crafatar.com/skins/${p.id}`,
      render: `https://crafatar.com/renders/body/${p.id}?overlay`,
      cape: null as string | null,
    };
    // Cape: playerdb sometimes includes properties; check Mojang session server textures
    try {
      const s = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid.replace(/-/g, "")}`, {
        headers: { "User-Agent": "OpenMC/1.0" },
      });
      if (s.ok) {
        const sj = await s.json();
        const prop = sj?.properties?.find((x: { name: string }) => x.name === "textures");
        if (prop?.value) {
          const decoded = JSON.parse(Buffer.from(prop.value, "base64").toString("utf8"));
          const capeUrl = decoded?.textures?.CAPE?.url as string | undefined;
          if (capeUrl) data.cape = capeUrl;
          const skinUrl = decoded?.textures?.SKIN?.url as string | undefined;
          if (skinUrl) data.skin = skinUrl;
        }
      }
    } catch { /* cape optional */ }
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json({ ok: true, cached: false, ...data });
  } catch {
    return NextResponse.json({ ok: false, error: "Network error reaching the profile API." }, { status: 502 });
  }
}

void isUuid;
