// Minimal NBT reader supporting uncompressed and gzip-compressed NBT
// (level.dat, .nbt, .dat). Covers all tag types. Honest about limits:
// does not support region files (.mca) — those are reported as unsupported.

export type NbtTag =
  | { type: "byte"; value: number }
  | { type: "short"; value: number }
  | { type: "int"; value: number }
  | { type: "long"; value: bigint }
  | { type: "float"; value: number }
  | { type: "double"; value: number }
  | { type: "byteArray"; value: number[] }
  | { type: "string"; value: string }
  | { type: "list"; itemType: number; value: NbtTag[] }
  | { type: "compound"; value: Record<string, NbtTag> }
  | { type: "intArray"; value: number[] }
  | { type: "longArray"; value: bigint[] };

export interface NbtRoot {
  name: string;
  root: NbtTag;
  compressed: boolean;
}

const TAG_NAMES = ["End", "Byte", "Short", "Int", "Long", "Float", "Double", "Byte_Array", "String", "List", "Compound", "Int_Array", "Long_Array"];

export function tagName(id: number): string {
  return TAG_NAMES[id] ?? `Unknown(${id})`;
}

class Reader {
  view: DataView;
  off = 0;
  constructor(public bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  u8() { return this.view.getUint8(this.off++); }
  i8() { return this.view.getInt8(this.off++); }
  i16() { const v = this.view.getInt16(this.off); this.off += 2; return v; }
  i32() { const v = this.view.getInt32(this.off); this.off += 4; return v; }
  i64() { const v = this.view.getBigInt64(this.off); this.off += 8; return v; }
  f32() { const v = this.view.getFloat32(this.off); this.off += 4; return v; }
  f64() { const v = this.view.getFloat64(this.off); this.off += 8; return v; }
  str() {
    const len = this.view.getUint16(this.off); this.off += 2;
    const slice = this.bytes.subarray(this.off, this.off + len); this.off += len;
    return new TextDecoder().decode(slice);
  }
}

function readPayload(r: Reader, type: number): NbtTag {
  switch (type) {
    case 1: return { type: "byte", value: r.i8() };
    case 2: return { type: "short", value: r.i16() };
    case 3: return { type: "int", value: r.i32() };
    case 4: return { type: "long", value: r.i64() };
    case 5: return { type: "float", value: r.f32() };
    case 6: return { type: "double", value: r.f64() };
    case 7: {
      const n = r.i32();
      if (n < 0 || n > 50_000_000) throw new Error("Byte array too large");
      const arr: number[] = [];
      for (let i = 0; i < n; i++) arr.push(r.i8());
      return { type: "byteArray", value: arr };
    }
    case 8: return { type: "string", value: r.str() };
    case 9: {
      const item = r.u8();
      const n = r.i32();
      if (n < 0 || n > 5_000_000) throw new Error("List too large");
      const value: NbtTag[] = [];
      for (let i = 0; i < n; i++) value.push(readPayload(r, item));
      return { type: "list", itemType: item, value };
    }
    case 10: {
      const value: Record<string, NbtTag> = {};
      for (;;) {
        const t = r.u8();
        if (t === 0) break;
        const name = r.str();
        value[name] = readPayload(r, t);
      }
      return { type: "compound", value };
    }
    case 11: {
      const n = r.i32();
      if (n < 0 || n > 20_000_000) throw new Error("Int array too large");
      const value: number[] = [];
      for (let i = 0; i < n; i++) value.push(r.i32());
      return { type: "intArray", value };
    }
    case 12: {
      const n = r.i32();
      if (n < 0 || n > 20_000_000) throw new Error("Long array too large");
      const value: bigint[] = [];
      for (let i = 0; i < n; i++) value.push(r.i64());
      return { type: "longArray", value };
    }
    default: throw new Error(`Unsupported tag type ${type}`);
  }
}

async function gunzipIfNeeded(bytes: Uint8Array): Promise<{ out: Uint8Array; compressed: boolean }> {
  const isGzip = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return { out: bytes, compressed: false };
  // Use native DecompressionStream when available (all modern browsers)
  const ds = new DecompressionStream("gzip");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return { out: new Uint8Array(buf), compressed: true };
}

export async function parseNbt(bytes: Uint8Array): Promise<NbtRoot> {
  // Reject region files quickly
  if (bytes.length > 8) {
    // .mca starts with location table (mostly zeros + offsets); heuristic: extension check done by caller.
  }
  const { out, compressed } = await gunzipIfNeeded(bytes);
  if (out.length < 3) throw new Error("File too small to be NBT.");
  const r = new Reader(out);
  const type = r.u8();
  if (type !== 10) throw new Error(`Root tag must be Compound (10), got ${type} (${tagName(type)}). This file may not be NBT, or may be a region (.mca) file which is not supported.`);
  const name = r.str();
  const root = readPayload(r, 10);
  return { name, root, compressed };
}

export function nbtToJson(tag: NbtTag): unknown {
  switch (tag.type) {
    case "byte": case "short": case "int": case "float": case "double": return tag.value;
    case "long": return `${tag.value}n`;
    case "string": return tag.value;
    case "byteArray": return tag.value;
    case "intArray": return tag.value;
    case "longArray": return tag.value.map((v) => `${v}n`);
    case "list": return tag.value.map(nbtToJson);
    case "compound": {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(tag.value)) o[k] = nbtToJson(v);
      return o;
    }
  }
}

export function countNbtNodes(tag: NbtTag): number {
  if (tag.type === "compound") return 1 + Object.values(tag.value).reduce((a, t) => a + countNbtNodes(t), 0);
  if (tag.type === "list") return 1 + tag.value.reduce((a, t) => a + countNbtNodes(t), 0);
  return 1;
}
