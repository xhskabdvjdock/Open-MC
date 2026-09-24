import { NextRequest, NextResponse } from "next/server";

// GET /api/server?host=play.example.com — proxy to mcsrvstat.us (public, no key).
// Normalizes Java/Bedrock differences and never claims online on failure.

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 60 * 1000;

export async function GET(req: NextRequest) {
  const host = (req.nextUrl.searchParams.get("host") ?? "").trim().toLowerCase();
  if (!host || host.length > 253 || !/^[a-z0-9._:\-]+$/i.test(host)) {
    return NextResponse.json({ ok: false, error: "Invalid server address. Example: play.example.com or play.example.com:25565" }, { status: 400 });
  }
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ ok: true, cached: true, ...(hit.data as object) });
  }
  const t0 = Date.now();
  try {
    const r = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`, {
      headers: { "User-Agent": "OpenMC/1.0" },
      next: { revalidate: 60 },
    });
    if (r.status === 429) {
      return NextResponse.json({ ok: false, error: "Rate limited by the status API. Try again shortly." }, { status: 429 });
    }
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: "Status API unavailable." }, { status: 502 });
    }
    const j = await r.json();
    const ms = Date.now() - t0;
    if (j?.online !== true) {
      const data = { online: false as const, host, latencyMs: ms };
      cache.set(host, { at: Date.now(), data });
      return NextResponse.json({ ok: true, ...data });
    }
    const data = {
      online: true as const,
      host,
      ip: (j.ip as string) ?? host,
      port: (j.port as number) ?? 25565,
      bedrock: Boolean(j.bedrock),
      version: (j.version as string) ?? (Array.isArray(j.players) ? "unknown" : "unknown"),
      protocol: (j.protocol as { version?: number } | number | undefined),
      players: {
        online: (j.players?.online as number) ?? 0,
        max: (j.players?.max as number) ?? 0,
        list: Array.isArray(j.players?.list) ? (j.players.list as { name: string }[]).slice(0, 20) : [],
      },
      motd: j.motd as { raw?: string[]; clean?: string[]; html?: string[] } | undefined,
      icon: (j.icon as string | undefined) ?? null,
      latencyMs: ms,
      software: (j.software as string | undefined) ?? null,
      plugins: Array.isArray(j.plugins) ? (j.plugins as { name: string }[]).slice(0, 20) : [],
    };
    cache.set(host, { at: Date.now(), data });
    return NextResponse.json({ ok: true, cached: false, ...data });
  } catch {
    return NextResponse.json({ ok: false, error: "Query failed — the server may be offline or unreachable." }, { status: 502 });
  }
}
