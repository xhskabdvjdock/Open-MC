"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Folder, FolderOpen, File as FileIcon, Image as ImageIcon, Music, Braces,
  Download, Trash2, Pencil, Plus, Save, ChevronRight, ChevronDown,
  PackageOpen, FileUp, Copy, ShieldCheck, Search, X, FilePlus2,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { PixelEditor, type PixelEditorHandle } from "@/components/PixelEditor";
import { ModelPreview, type McModel } from "@/components/ModelPreview";
import { Btn, IconBtn, ContextMenu, type CtxItem, Resizer, StatusBar, EmptyState } from "@/components/ui";
import { loadZipSafely, sanitizeZipPath, sniffAudio } from "@/lib/zip-safety";
import { packFormatForVersion } from "@/lib/versions";
import { validatePack } from "@/lib/validate-pack";
import { loadImage, formatBytes, downloadBlob } from "@/lib/pixel-utils";
import { saveProject, getProject, uid } from "@/lib/storage";
import { consumeNewProject } from "@/components/NewProjectDialog";
import { consumeOpenProject } from "@/lib/projects";

type FilesMap = Map<string, Uint8Array>;

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}
function baseOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

interface TreeNode {
  name: string;
  path: string; // "" for root
  dirs: TreeNode[];
  files: string[];
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", dirs: [], files: [] };
  const dirMap = new Map<string, TreeNode>([["", root]]);
  const ensure = (dir: string): TreeNode => {
    const hit = dirMap.get(dir);
    if (hit) return hit;
    const parent = ensure(dirOf(dir));
    const node: TreeNode = { name: baseOf(dir), path: dir, dirs: [], files: [] };
    parent.dirs.push(node);
    dirMap.set(dir, node);
    return node;
  };
  for (const p of paths) {
    const d = dirOf(p);
    ensure(d).files.push(p);
  }
  const sortNode = (n: TreeNode) => {
    n.dirs.sort((a, b) => a.name.localeCompare(b.name));
    n.files.sort((a, b) => baseOf(a).localeCompare(baseOf(b)));
    n.dirs.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

function fileIcon(path: string): React.ElementType {
  if (/\.png$/i.test(path)) return ImageIcon;
  if (/\.(ogg|wav|mp3)$/i.test(path)) return Music;
  if (/\.json$/i.test(path) || path === "pack.mcmeta") return Braces;
  return FileIcon;
}

// True-pixel thumbnail — real PNG bytes, no palette, no blur, DPR-aware via crisp-edges
function PngThumb({ bytes, alt, size = 64 }: { bytes: Uint8Array; alt: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const blob = new Blob([bytes as unknown as BlobPart], { type: "image/png" });
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes]);
  if (!url) {
    return <span className="checker grid place-items-center rounded-sm border" style={{ width: size, height: size, borderColor: "var(--border)", color: "var(--faint)", fontSize: 10 }}>…</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className="pixel checker rounded-sm border object-contain"
      style={{ width: size, height: size, imageRendering: "pixelated", borderColor: "var(--border)" }}
    />
  );
}

export default function ResourcePackPage() {
  const { notify, mcVersion, autosave, showGrid, setProject } = useApp();
  const [packName, setPackName] = useState("MyPack");
  const [files, setFiles] = useState<FilesMap>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mcmetaText, setMcmetaText] = useState("");
  const [mcmetaError, setMcmetaError] = useState("");
  const [modelText, setModelText] = useState("");
  const [modelError, setModelError] = useState("");
  const [soundUrls, setSoundUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState("");
  const [imgDims, setImgDims] = useState<[number, number] | null>(null);
  const [editingImg, setEditingImg] = useState<HTMLImageElement | null>(null);
  const [editKey, setEditKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(8);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["assets", "assets/minecraft", "assets/minecraft/textures"]));
  const [treeQuery, setTreeQuery] = useState("");
  const [ctx, setCtx] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  const [uploadDir, setUploadDir] = useState("");
  const [explorerW, setExplorerW] = useState(264);
  const [propsW, setPropsW] = useState(248);
  const [quickReport, setQuickReport] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const editorRef = useRef<PixelEditorHandle>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const addInput = useRef<HTMLInputElement>(null);

  const markDirty = useCallback(() => setDirty(true), []);
  const fileList = useMemo(() => [...files.keys()].sort(), [files]);
  const totalBytes = useMemo(() => [...files.values()].reduce((a, b) => a + b.length, 0), [files]);
  const tree = useMemo(() => buildTree(fileList), [fileList]);

  const filtered = useMemo(() => {
    const q = treeQuery.trim().toLowerCase();
    if (!q) return null;
    return fileList.filter((f) => f.toLowerCase().includes(q)).slice(0, 200);
  }, [treeQuery, fileList]);

  // ---- responsive: fixed pane widths on desktop only (set after mount, SSR-safe) ----
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ---- auto-expand textures so drawings are discoverable immediately ----
  useEffect(() => {
    if (fileList.some((p) => p.startsWith("assets/minecraft/textures/"))) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.add("assets");
        next.add("assets/minecraft");
        next.add("assets/minecraft/textures");
        // Also reveal the first level of texture types (block, item, entity…) so user isn't stuck
        for (const p of fileList) {
          if (p.startsWith("assets/minecraft/textures/")) {
            const rest = p.slice("assets/minecraft/textures/".length);
            const seg = rest.split("/")[0];
            if (seg && rest.includes("/")) next.add(`assets/minecraft/textures/${seg}`);
          }
        }
        return next;
      });
    }
  }, [fileList]);

  // ---- revoke the single-file preview URL when it changes / unmounts (avoid blob leak) ----
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        try { URL.revokeObjectURL(previewUrl); } catch { /* ignore */ }
      }
    };
  }, [previewUrl]);

  // ---- import ----
  const importBlob = useCallback(async (blob: Blob, name: string) => {
    setBusy("Reading archive…");
    try {
      const { entries } = await loadZipSafely(blob);
      const next: FilesMap = new Map();
      for (const e of entries) {
        if (e.dir) continue;
        next.set(e.path, await e.getData());
      }
      setFiles(next);
      setPackName(name || "MyPack");
      setSelected(null);
      setLoaded(true);
      const mc = next.get("pack.mcmeta");
      if (mc) setMcmetaText(new TextDecoder().decode(mc));
      else {
        const fmt = packFormatForVersion(mcVersion);
        setMcmetaText(JSON.stringify({ pack: { pack_format: fmt, description: `${name} — made with Open MC` } }, null, 2));
      }
      setQuickReport(null);
      notify(`Imported ${next.size} files`);
      setDirty(true);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Invalid Resource Pack", "err");
    } finally {
      setBusy("");
    }
  }, [markDirty, mcVersion, notify]);

  const importZip = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) { notify("Only .zip resource packs are supported.", "err"); return; }
    await importBlob(f, f.name.replace(/\.zip$/i, ""));
  }, [importBlob, notify]);

  const newBlankPack = useCallback(() => {
    const fmt = packFormatForVersion(mcVersion);
    const mc = JSON.stringify({ pack: { pack_format: fmt, description: "My pack — made with Open MC" } }, null, 2);
    const next: FilesMap = new Map();
    next.set("pack.mcmeta", new TextEncoder().encode(mc));
    setFiles(next);
    setMcmetaText(mc);
    setPackName("MyPack");
    setSelected(null);
    setLoaded(true);
    setQuickReport(null);
    markDirty();
    notify("Blank pack created");
  }, [markDirty, mcVersion, notify]);

  // ---- project indicator ----
  useEffect(() => {
    if (loaded) setProject({ name: packName, kind: "Resource Pack", dirty });
    else setProject(null);
  }, [loaded, packName, dirty, setProject]);
  useEffect(() => () => setProject(null), [setProject]);

  // ---- seeds: new blank project / reopen saved project ----
  useEffect(() => {
    let live = true;
    (async () => {
      const seedName = consumeNewProject("resource-pack");
      if (seedName && live) {
        const fmt = packFormatForVersion(mcVersion);
        const mc = JSON.stringify({ pack: { pack_format: fmt, description: `${seedName} — made with Open MC` } }, null, 2);
        const next: FilesMap = new Map();
        next.set("pack.mcmeta", new TextEncoder().encode(mc));
        setFiles(next);
        setMcmetaText(mc);
        setPackName(seedName);
        setLoaded(true);
        setDirty(true);
        notify(`Project "${seedName}" created`);
        return;
      }
      const openId = consumeOpenProject("resource-pack");
      if (openId && live) {
        const rec = await getProject(openId);
        if (rec && typeof rec.data === "object" && live) {
          await importBlob(rec.data as Blob, rec.name.replace(/\.zip$/i, ""));
        }
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcVersion, importBlob, notify]);

  // ---- selection ----
  const openPath = useCallback(async (path: string) => {
    setSelected(path);
    setPreviewUrl("");
    setImgDims(null);
    setEditingImg(null);
    setModelText("");
    setModelError("");
    const bytes = files.get(path);
    if (!bytes) return;
    if (/\.png$/i.test(path)) {
      try {
        const blob = new Blob([bytes as BlobPart], { type: "image/png" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        const img = await loadImage(blob);
        setImgDims([img.naturalWidth, img.naturalHeight]);
        setEditingImg(img);
        setEditKey((k) => k + 1);
        setZoom(8);
      } catch {
        notify("Could not decode PNG.", "err");
      }
    } else if (/\.json$/i.test(path) || path === "pack.mcmeta") {
      const text = new TextDecoder().decode(bytes);
      if (path === "pack.mcmeta") setMcmetaText(text);
      else setModelText(text);
    } else if (/\.(ogg|wav|mp3)$/i.test(path)) {
      const kind = sniffAudio(bytes);
      const mime = kind === "ogg" ? "audio/ogg" : kind === "wav" ? "audio/wav" : "audio/mpeg";
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
      setSoundUrls((s) => ({ ...s, [path]: url }));
      setPreviewUrl(url);
    } else if (/\.(txt|mcmeta|lang|properties)$/i.test(path)) {
      setModelText(new TextDecoder().decode(bytes));
    }
  }, [files, notify]);

  // ---- mutations ----
  const addFiles = useCallback(async (uploads: File[], targetDir?: string) => {
    const dir = targetDir ?? uploadDir;
    const next = new Map(files);
    let added = 0;
    for (const f of uploads) {
      const target = dir ? `${dir}/${f.name}` : f.name;
      const safe = sanitizeZipPath(target);
      if (!safe) { notify(`Rejected unsafe name: ${f.name}`, "err"); continue; }
      if (f.size > 50 * 1024 * 1024) { notify(`${f.name} is larger than 50 MB — skipped.`, "err"); continue; }
      next.set(safe, new Uint8Array(await f.arrayBuffer()));
      added++;
    }
    setFiles(next);
    if (added) { notify(`Added ${added} file${added === 1 ? "" : "s"}`); markDirty(); }
  }, [files, uploadDir, markDirty, notify]);

  const replaceSelected = useCallback(async (uploads: File[]) => {
    if (!selected) return;
    const f = uploads[0];
    if (!f) return;
    const next = new Map(files);
    next.set(selected, new Uint8Array(await f.arrayBuffer()));
    setFiles(next);
    markDirty();
    notify("Replaced");
    openPath(selected);
  }, [selected, files, markDirty, notify, openPath]);

  const deletePath = useCallback((path: string, isDir: boolean) => {
    if (!confirm(`Delete ${path}? This cannot be undone.`)) return;
    const next = new Map(files);
    if (isDir) {
      for (const k of [...next.keys()]) if (k === path || k.startsWith(path + "/")) next.delete(k);
    } else {
      next.delete(path);
    }
    setFiles(next);
    if (selected === path || (isDir && selected?.startsWith(path + "/"))) setSelected(null);
    markDirty();
    notify("Deleted");
  }, [files, selected, markDirty, notify]);

  const renamePath = useCallback((path: string, isDir: boolean) => {
    const base = baseOf(path);
    const nextName = prompt("New name:", base);
    if (!nextName || nextName === base) return;
    if (/[/\\]/.test(nextName)) { notify("Name must not contain slashes.", "err"); return; }
    const parent = dirOf(path);
    const dest = parent ? `${parent}/${nextName}` : nextName;
    if (!sanitizeZipPath(isDir ? dest + "/x" : dest)) { notify("Invalid name.", "err"); return; }
    const next = new Map(files);
    if (isDir) {
      for (const k of [...next.keys()]) {
        if (k === path || k.startsWith(path + "/")) {
          next.set(dest + k.slice(path.length), next.get(k)!);
          next.delete(k);
        }
      }
    } else {
      if (next.has(dest)) { notify("A file with that name already exists.", "err"); return; }
      next.set(dest, next.get(path)!);
      next.delete(path);
      if (selected === path) setSelected(dest);
    }
    setFiles(next);
    markDirty();
    notify("Renamed");
  }, [files, selected, markDirty, notify]);

  const duplicateFile = useCallback((path: string) => {
    const bytes = files.get(path);
    if (!bytes) return;
    const dir = dirOf(path);
    const base = baseOf(path);
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : "";
    let dest = dir ? `${dir}/${stem} copy${ext}` : `${stem} copy${ext}`;
    let n = 2;
    const next = new Map(files);
    while (next.has(dest)) {
      dest = dir ? `${dir}/${stem} copy ${n}${ext}` : `${stem} copy ${n}${ext}`;
      n++;
    }
    next.set(dest, bytes.slice());
    setFiles(next);
    markDirty();
    notify("Duplicated");
  }, [files, markDirty, notify]);

  const downloadPath = useCallback((path: string) => {
    const bytes = files.get(path);
    if (!bytes) return;
    const mime = /\.png$/i.test(path) ? "image/png" : /\.json$/i.test(path) ? "application/json" : "application/octet-stream";
    downloadBlob(new Blob([bytes as BlobPart], { type: mime }), baseOf(path));
    notify("Downloaded");
  }, [files, notify]);

  const createFolder = useCallback(() => {
    const base = selected && !files.has(selected) ? selected : dirOf(selected ?? "");
    const name = prompt("Folder name:", "");
    if (!name) return;
    if (/[/\\]/.test(name)) { notify("Folder name must not contain slashes.", "err"); return; }
    const dest = base ? `${base}/${name}` : name;
    if (!sanitizeZipPath(dest + "/x")) { notify("Invalid name.", "err"); return; }
    setExpanded((s) => new Set(s).add(dest));
    notify(`Folder "${dest}" will exist once you add files to it`);
  }, [selected, files, notify]);

  // ---- save current (Ctrl+S) ----
  const saveMcmeta = useCallback(() => {
    try {
      const parsed = JSON.parse(mcmetaText);
      if (!parsed.pack || typeof parsed.pack.pack_format !== "number") throw new Error('"pack.pack_format" must be a number.');
      setMcmetaError("");
      const next = new Map(files);
      next.set("pack.mcmeta", new TextEncoder().encode(JSON.stringify(parsed, null, 2)));
      setFiles(next);
      setMcmetaText(JSON.stringify(parsed, null, 2));
      markDirty();
      notify("pack.mcmeta saved");
      return true;
    } catch (e) {
      setMcmetaError(e instanceof Error ? e.message : "Invalid JSON");
      notify("Invalid JSON — not saved.", "err");
      return false;
    }
  }, [mcmetaText, files, markDirty, notify]);

  const saveModelJson = useCallback(() => {
    if (!selected) return false;
    try {
      const parsed = JSON.parse(modelText);
      setModelError("");
      const next = new Map(files);
      next.set(selected, new TextEncoder().encode(JSON.stringify(parsed, null, 2)));
      setFiles(next);
      setModelText(JSON.stringify(parsed, null, 2));
      markDirty();
      notify("Model saved");
      return true;
    } catch (e) {
      setModelError(e instanceof Error ? e.message : "Invalid JSON");
      notify("Invalid JSON — not saved.", "err");
      return false;
    }
  }, [selected, modelText, files, markDirty, notify]);

  const applyTextureEdit = useCallback(async () => {
    if (!selected || !editorRef.current) return false;
    const blob = await editorRef.current.getBlob();
    if (!blob) { notify("Export failed", "err"); return false; }
    const next = new Map(files);
    next.set(selected, new Uint8Array(await blob.arrayBuffer()));
    setFiles(next);
    markDirty();
    notify("Texture saved");
    return true;
  }, [selected, files, markDirty, notify]);

  const saveCurrent = useCallback(() => {
    if (!selected) return;
    if (/\.png$/i.test(selected)) void applyTextureEdit();
    else if (/\.json$/i.test(selected)) saveModelJson();
    else if (selected === "pack.mcmeta") saveMcmeta();
    else if (/\.(txt|lang|properties)$/i.test(selected)) {
      const next = new Map(files);
      next.set(selected, new TextEncoder().encode(modelText));
      setFiles(next);
      markDirty();
      notify("File saved");
    } else {
      notify("Nothing to save for binary files.", "info");
    }
  }, [selected, applyTextureEdit, saveModelJson, saveMcmeta, files, modelText, markDirty, notify]);

  // ---- quick validate ----
  const quickValidate = useCallback(async () => {
    setBusy("Validating…");
    try {
      const list = await Promise.all(
        [...files.entries()].map(async ([path, bytes]) => ({
          path, size: bytes.length,
          bytes: async () => bytes,
          text: async () => new TextDecoder().decode(bytes),
        }))
      );
      const rep = await validatePack(list, mcVersion);
      setQuickReport(
        rep.ok
          ? `Valid — ${rep.checkedFiles} files, ${rep.warnings.length} warning(s). Full report in Validator.`
          : `${rep.errors.length} error(s), ${rep.warnings.length} warning(s). See Validator for details.`
      );
      notify(rep.ok ? "Validation passed" : "Problems found — see Validator", rep.ok ? "ok" : "err");
    } finally {
      setBusy("");
    }
  }, [files, mcVersion, notify]);

  // ---- export ----
  const exportZip = useCallback(async () => {
    if (!files.size) { notify("Nothing to export.", "err"); return; }
    try {
      JSON.parse(new TextDecoder().decode(files.get("pack.mcmeta") ?? new TextEncoder().encode(mcmetaText)));
    } catch {
      notify("Cannot export: pack.mcmeta is invalid JSON. Fix it first.", "err");
      return;
    }
    setBusy("Building .zip…");
    try {
      const zip = new JSZip();
      for (const [path, bytes] of files) zip.file(path, bytes);
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      downloadBlob(blob, `${packName || "MyPack"}.zip`);
      await saveProject({ id: uid("pack"), kind: "resource-pack", name: packName, updatedAt: Date.now(), data: blob });
      setDirty(false);
      notify("Exported");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed", "err");
    } finally {
      setBusy("");
    }
  }, [files, mcmetaText, packName, notify]);

  // ---- autosave ----
  useEffect(() => {
    if (!autosave || !dirty || !loaded) return;
    const id = setTimeout(async () => {
      try {
        const zip = new JSZip();
        for (const [path, bytes] of files) zip.file(path, bytes);
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        await saveProject({ id: "autosave-pack", kind: "resource-pack", name: `${packName} (autosave)`, updatedAt: Date.now(), data: blob });
        setDirty(false);
      } catch { /* silent */ }
    }, 2500);
    return () => clearTimeout(id);
  }, [autosave, dirty, loaded, files, packName]);

  // ---- shortcuts: Ctrl+S save · Ctrl+O open · Ctrl+E export · Del delete ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); if (!typing) saveCurrent(); }
      else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); zipInput.current?.click(); }
      else if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); void exportZip(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selected) {
        e.preventDefault();
        deletePath(selected, false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveCurrent, exportZip, selected, deletePath]);

  const audioMeta = useMemo(() => {
    if (!selected || !/\.(ogg|wav|mp3)$/i.test(selected)) return null;
    const bytes = files.get(selected);
    if (!bytes) return null;
    return { size: bytes.length, format: sniffAudio(bytes) };
  }, [selected, files]);

  const parsedModel: McModel | null = useMemo(() => {
    if (!selected || !/\.json$/i.test(selected)) return null;
    try { return JSON.parse(modelText || "{}"); } catch { return null; }
  }, [selected, modelText]);

  const mcmetaSummary = useMemo(() => {
    try {
      const d = JSON.parse(new TextDecoder().decode(files.get("pack.mcmeta") ?? new Uint8Array())) as {
        pack?: { pack_format?: number; description?: unknown };
      };
      return { format: d?.pack?.pack_format as number | undefined, desc: typeof d?.pack?.description === "string" ? d.pack.description : undefined };
    } catch {
      return { format: undefined, desc: undefined };
    }
  }, [files, mcmetaText]);

  if (!loaded) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-[19px] font-bold tracking-tight">
            <PackageOpen className="size-5" aria-hidden style={{ color: "var(--accent)" }} />
            Resource Pack Studio
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            Import a <span className="font-mono">.zip</span> — parsed locally in your browser, never uploaded.
          </p>
        </div>
        <Dropzone accept=".zip" onFiles={importZip} label="Drop a resource pack .zip here or click to browse" hint="Path traversal rejected · archives over 500 MB / 8000 files rejected (ZIP-bomb protection)" />
        <div className="flex items-center gap-2">
          <Btn primary onClick={newBlankPack}>
            <Plus className="size-4" aria-hidden /> New blank pack
          </Btn>
          {busy && <span className="text-[13px]" style={{ color: "var(--muted)" }} role="status">{busy}</span>}
        </div>
        <p className="font-mono text-[12px]" style={{ color: "var(--faint)" }}>
          pack.mcmeta · pack.png · assets/minecraft/textures/…
        </p>
      </div>
    );
  }

  const selIsPng = selected ? /\.png$/i.test(selected) : false;
  const selIsJson = selected ? /\.json$/i.test(selected) : false;
  const selIsAudio = selected ? /\.(ogg|wav|mp3)$/i.test(selected) : false;
  const selIsText = selected ? /\.(txt|mcmeta|lang|properties)$/i.test(selected) && !selIsJson : false;

  const ctxItems = (path: string, isDir: boolean): CtxItem[] => {
    const items: CtxItem[] = [
      { label: "Open", icon: <FolderOpen className="size-4" />, disabled: isDir, onSelect: () => void openPath(path) },
      {
        label: "Add files here", icon: <FileUp className="size-4" />, disabled: !isDir,
        onSelect: () => { setUploadDir(path); addInput.current?.click(); },
      },
      { label: "Download", icon: <Download className="size-4" />, disabled: isDir, onSelect: () => downloadPath(path) },
      { label: "Duplicate", icon: <Copy className="size-4" />, disabled: isDir, onSelect: () => duplicateFile(path) },
      { label: "Rename", icon: <Pencil className="size-4" />, onSelect: () => renamePath(path, isDir) },
      { label: "Delete", icon: <Trash2 className="size-4" />, danger: true, onSelect: () => deletePath(path, isDir) },
    ];
    return items;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={packName}
          onChange={(e) => { setPackName(e.target.value); markDirty(); }}
          aria-label="Pack name"
          spellCheck={false}
          className="w-48 rounded border px-2 py-1 text-[14px] font-bold outline-none"
          style={{ borderColor: "transparent", background: "transparent" }}
          onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = "var(--border)")}
          onBlur={(e) => ((e.target as HTMLInputElement).style.borderColor = "transparent")}
        />
        <span className="flex items-center gap-1.5 font-mono text-[11.5px]" style={{ color: "var(--muted)" }} role="status">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: dirty ? "var(--warn)" : "var(--accent)" }}
            title={dirty ? "Unsaved changes" : "Saved locally"}
          />
          {busy || (dirty ? "Unsaved changes" : "Saved locally")}
        </span>
        <span className="ms-auto flex items-center gap-1.5">
          <Btn onClick={quickValidate} title="Validate against target version">
            <ShieldCheck className="size-4" aria-hidden /> Validate
          </Btn>
          <Btn onClick={saveCurrent} title="Save current file (Ctrl+S)">
            <Save className="size-4" aria-hidden /> Save
          </Btn>
          <Btn primary onClick={exportZip} title="Export .zip (Ctrl+E)">
            <Download className="size-4" aria-hidden /> Export
          </Btn>
          <Btn
            onClick={() => { setLoaded(false); setFiles(new Map()); setSelected(null); setProject(null); }}
            title="Close pack"
          >
            <X className="size-4" aria-hidden />
          </Btn>
        </span>
      </div>
      {quickReport && (
        <p className="rounded border px-2.5 py-1.5 font-mono text-[12px]" style={{ borderColor: "var(--border)", background: "var(--panel)" }} role="status">
          {quickReport}
        </p>
      )}

      {/* 3-pane workspace */}
      <div className="flex min-h-[480px] flex-1 flex-col gap-0 lg:flex-row" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)", overflow: "hidden" }}>
        {/* explorer */}
        <section
          aria-label="File explorer"
          className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-e"
          style={{ borderColor: "var(--border)", ...(isDesktop ? { width: explorerW, flex: "none" } : {}) }}
        >
          <div className="flex items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2" aria-hidden style={{ color: "var(--faint)" }} />
              <input
                value={treeQuery}
                onChange={(e) => setTreeQuery(e.target.value)}
                placeholder="Search files…"
                aria-label="Search files"
                spellCheck={false}
                className="w-full rounded border py-1 pe-2 ps-7 text-[12.5px] outline-none"
                style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}
              />
            </div>
            <IconBtn label="New folder" onClick={createFolder}>
              <FilePlus2 className="size-4" aria-hidden />
            </IconBtn>
            <IconBtn label="Add files" onClick={() => { setUploadDir(selected ? dirOf(selected) : ""); addInput.current?.click(); }}>
              <FileUp className="size-4" aria-hidden />
            </IconBtn>
          </div>
          <div className="max-h-64 min-h-0 flex-1 overflow-y-auto p-1 lg:max-h-none" role="tree" aria-label="Pack files">
            {filtered ? (
              <ul>
                {filtered.map((f) => {
                  const Icon = fileIcon(f);
                  const active = selected === f;
                  return (
                    <li key={f}>
                      <button
                        onClick={() => void openPath(f)}
                        className="file-row ui-transition flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-start"
                        data-active={active}
                        aria-current={active ? "true" : undefined}
                      >
                        <Icon className="size-3.5 shrink-0" aria-hidden style={{ color: "var(--faint)" }} />
                        <span className="truncate font-mono text-[12px]">{f}</span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && <li className="px-2 py-4 text-center text-[12px]" style={{ color: "var(--muted)" }}>No matches.</li>}
              </ul>
            ) : (
              <TreeNodeView
                node={tree}
                depth={0}
                expanded={expanded}
                toggle={(p) => setExpanded((s) => {
                  const n = new Set(s);
                  if (n.has(p)) n.delete(p); else n.add(p);
                  return n;
                })}
                selected={selected}
                onSelect={(p) => void openPath(p)}
                onCtx={(e, path, isDir) => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, path, isDir }); }}
              />
            )}
          </div>
          <div className="border-t px-2.5 py-1 font-mono text-[10.5px]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
            {files.size} files · {formatBytes(totalBytes)}
          </div>
        </section>

        <div className="hidden lg:block"><Resizer onResize={(dx) => setExplorerW((w) => Math.min(420, Math.max(180, w + dx)))} /></div>

        {/* editor */}
        <section aria-label="Editor" className="flex min-h-[320px] min-w-0 flex-1 flex-col" style={{ background: "var(--bg)" }}>
          {!selected ? (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
              {/* Pack header: icon + meta, so user instantly knows it's a pack not a code file */}
              <div className="flex items-center gap-3 rounded border p-3" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
                {files.get("pack.png") ? (
                  <PngThumb bytes={files.get("pack.png")!} alt="pack.png" size={56} />
                ) : (
                  <span className="grid size-14 place-items-center rounded-sm border" style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--faint)" }}>
                    <PackageOpen className="size-6" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{packName}</div>
                  <div className="truncate font-mono text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {mcmetaSummary.desc ?? "No description yet — select pack.mcmeta in the tree to edit."} · format {mcmetaSummary.format ?? "—"} · target {mcVersion}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--faint)" }}>
                    {files.size} files · {formatBytes(totalBytes)} · Click a thumbnail below to pixel-edit — never JSON.
                  </div>
                </div>
              </div>

              {/* Textures gallery: the actual drawings — this is what user asked for */}
              {(() => {
                const pngs = fileList.filter((p) => /\.png$/i.test(p));
                if (pngs.length === 0) {
                  return (
                    <EmptyState
                      title="No images found"
                      body="This pack contains no .png files. Add textures under assets/minecraft/textures/ and they'll appear here."
                    />
                  );
                }
                const showing = pngs.slice(0, 240);
                const more = pngs.length - showing.length;
                return (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <h2 className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>
                        Textures · {pngs.length} drawings — click to edit
                      </h2>
                      <span className="ms-auto font-mono text-[11px]" style={{ color: "var(--faint)" }}>
                        {more > 0 ? `showing 240 of ${pngs.length}` : `${pngs.length} images`}
                      </span>
                    </div>
                    <ul className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
                      {showing.map((p) => {
                        const b = files.get(p);
                        return (
                          <li key={p}>
                            <button
                              onClick={() => void openPath(p)}
                              title={`${p} — click to pixel-edit • true colors • alpha kept`}
                              aria-label={`Edit ${baseOf(p)}`}
                              className="ui-transition flex w-full flex-col items-center gap-1 rounded border p-2 text-center hover:opacity-90"
                              style={{ borderColor: "var(--border)", background: "var(--panel)" }}
                            >
                              {b ? (
                                <PngThumb bytes={b} alt="" size={64} />
                              ) : (
                                <span className="checker grid h-16 w-16 place-items-center rounded-sm border text-[10px]" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
                                  PNG
                                </span>
                              )}
                              <span className="line-clamp-2 w-full break-all font-mono text-[10.5px] leading-tight">{baseOf(p)}</span>
                              <span className="w-full truncate font-mono text-[10px]" style={{ color: "var(--faint)" }}>
                                {p.replace(/^assets\/minecraft\/textures\//, "")}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      Tip: right-click any file in the tree for Rename / Duplicate / Delete. Press <span className="font-mono">Ctrl+S</span> in the pixel editor to save changes into the pack, then <span className="font-mono">Export</span> to get a new .zip.
                    </p>
                  </div>
                );
              })()}

              {/* Compact meta editor is still available but not the focus — user must pick pack.mcmeta explicitly to edit JSON */}
              <details className="rounded border p-2" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
                <summary className="cursor-pointer list-inside text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                  pack.mcmeta — JSON (only shown when you need it)
                </summary>
                <div className="mt-2">
                  <textarea
                    value={mcmetaText}
                    onChange={(e) => { setMcmetaText(e.target.value); setMcmetaError(""); }}
                    rows={7}
                    spellCheck={false}
                    aria-label="pack.mcmeta JSON"
                    className="w-full rounded border p-2 font-mono text-[12px] outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}
                  />
                  {mcmetaError && <p className="mt-1 text-[12px]" style={{ color: "var(--danger)" }} role="alert">{mcmetaError}</p>}
                  <div className="mt-1.5">
                    <Btn primary onClick={saveMcmeta}>
                      <Save className="size-4" aria-hidden /> Save pack.mcmeta
                    </Btn>
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5 border-b px-2.5 py-1.5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
                <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{selected}</code>
                <label className="ui-transition cursor-pointer rounded border px-2 py-1 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }} title="Replace file">
                  Replace
                  <input type="file" className="hidden" onChange={async (e) => { if (e.target.files) await replaceSelected([...e.target.files]); e.target.value = ""; }} />
                </label>
                <IconBtn label="Download file" onClick={() => downloadPath(selected)}>
                  <Download className="size-4" aria-hidden />
                </IconBtn>
                <IconBtn label="Save file (Ctrl+S)" onClick={saveCurrent}>
                  <Save className="size-4" aria-hidden />
                </IconBtn>
                <IconBtn label="Close file" onClick={() => setSelected(null)}>
                  <X className="size-4" aria-hidden />
                </IconBtn>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {selIsPng ? (
                  // Drawings first — pixel-perfect editor, never JSON. Loading state while decoding.
                  editingImg && imgDims ? (
                    <PixelEditor
                      key={selected + editKey}
                      ref={editorRef}
                      width={imgDims[0]}
                      height={imgDims[1]}
                      initialImage={editingImg}
                      showGridDefault={showGrid}
                      onEdit={markDirty}
                      onZoomChange={setZoom}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      {(() => {
                        const b = files.get(selected ?? "");
                        if (!b) {
                          return (
                            <span className="grid size-16 place-items-center rounded-sm border" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
                              <ImageIcon className="size-6" aria-hidden />
                            </span>
                          );
                        }
                        return (
                          <span className="checker inline-grid place-items-center rounded-sm border p-2" style={{ borderColor: "var(--border)" }}>
                            <PngThumb bytes={b} alt={`Preview of ${selected}`} size={Math.min(256, Math.max(64, imgDims ? imgDims[0] * 4 : 128))} />
                          </span>
                        );
                      })()}
                      <p className="text-[13px]" style={{ color: "var(--muted)" }}>Loading true-pixel drawing…</p>
                      <p className="font-mono text-[11.5px]" style={{ color: "var(--faint)" }}>{selected} · {formatBytes(files.get(selected ?? "")?.length ?? 0)}</p>
                    </div>
                  )
                ) : (selIsJson || selected === "pack.mcmeta") ? (
                  <div className="grid min-h-full gap-3 xl:grid-cols-2">
                    <div className="flex min-w-0 flex-col">
                      <div className="mb-1 flex items-center gap-2">
                        <button
                          onClick={() => {
                            try {
                              const src = selected === "pack.mcmeta" ? mcmetaText : modelText;
                              const fmt = JSON.stringify(JSON.parse(src), null, 2);
                              if (selected === "pack.mcmeta") setMcmetaText(fmt); else setModelText(fmt);
                            } catch { notify("Invalid JSON — cannot format.", "err"); }
                          }}
                          className="ui-transition rounded border px-2 py-0.5 text-[12px]"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Format
                        </button>
                        {(modelError || mcmetaError) && <span className="text-[12px]" style={{ color: "var(--danger)" }} role="alert">{modelError || mcmetaError}</span>}
                      </div>
                      <textarea
                        value={selected === "pack.mcmeta" ? mcmetaText : modelText}
                        onChange={(e) => { if (selected === "pack.mcmeta") { setMcmetaText(e.target.value); setMcmetaError(""); } else { setModelText(e.target.value); setModelError(""); } }}
                        rows={20}
                        spellCheck={false}
                        aria-label={`Edit ${selected}`}
                        className="w-full flex-1 rounded border p-2 font-mono text-[12px] outline-none"
                        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <ModelPreview model={parsedModel} />
                      {!parsedModel && <p className="mt-1 text-[12.5px]" style={{ color: "var(--danger)" }}>Invalid JSON — fix syntax to preview.</p>}
                    </div>
                  </div>
                ) : selIsAudio ? (
                  <div className="flex max-w-lg flex-col gap-2">
                    <dl className="grid grid-cols-[96px_1fr] gap-1 rounded border p-3 text-[12.5px]" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
                      <dt style={{ color: "var(--muted)" }}>Filename</dt><dd className="font-mono">{baseOf(selected)}</dd>
                      <dt style={{ color: "var(--muted)" }}>Size</dt><dd className="font-mono">{formatBytes(audioMeta?.size ?? 0)}</dd>
                      <dt style={{ color: "var(--muted)" }}>Format</dt><dd className="font-mono">{audioMeta?.format ?? "unknown"}</dd>
                      <dt style={{ color: "var(--muted)" }}>Duration</dt><dd><DurationProbe url={soundUrls[selected ?? ""] ?? previewUrl} /></dd>
                    </dl>
                    {(soundUrls[selected ?? ""] ?? previewUrl) && (
                      <audio controls src={soundUrls[selected ?? ""] ?? previewUrl} className="w-full" preload="metadata" />
                    )}
                    <p className="text-[11.5px]" style={{ color: "var(--muted)" }}>Sounds are never converted — replace preserves bytes exactly.</p>
                  </div>
                ) : selIsText ? (
                  <div className="flex min-h-full flex-col">
                    <textarea value={modelText} onChange={(e) => setModelText(e.target.value)} rows={20} spellCheck={false} aria-label={`Edit ${selected}`} className="w-full flex-1 rounded border p-2 font-mono text-[12px] outline-none" style={{ borderColor: "var(--border)", background: "var(--panel)" }} />
                  </div>
                ) : (
                  <EmptyState title="Binary file" body={`${formatBytes(files.get(selected ?? "")?.length ?? 0)} — use Replace or Download.`} />
                )}
              </div>
            </div>
          )}
        </section>

        <div className="hidden lg:block"><Resizer onResize={(dx) => setPropsW((w) => Math.min(360, Math.max(200, w - dx)))} /></div>

        {/* properties */}
        <aside
          aria-label="Properties"
          className="min-h-0 overflow-y-auto border-t p-3 lg:border-t-0 lg:border-s"
          style={{ borderColor: "var(--border)", background: "var(--panel)", ...(isDesktop ? { width: propsW, flex: "none" } : {}) }}
        >
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>Properties</h2>
          {selected && files.get(selected) ? (
            <dl className="flex flex-col gap-1.5 text-[12.5px]">
              <Prop label="Name" mono>{baseOf(selected)}</Prop>
              <Prop label="Path" mono breakAll>{selected}</Prop>
              <Prop label="Size" mono>{formatBytes(files.get(selected)!.length)}</Prop>
              {imgDims && <Prop label="Dimensions" mono>{imgDims[0]} × {imgDims[1]} px</Prop>}
              {imgDims && <Prop label="Zoom" mono>{zoom * 100}%</Prop>}
              {audioMeta && <Prop label="Format" mono>{audioMeta.format}</Prop>}
              {selIsJson && <Prop label="JSON" mono>{parsedModel ? "valid" : "invalid"}</Prop>}
            </dl>
          ) : (
            <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Select a file to inspect it.</p>
          )}
          <h2 className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>Pack</h2>
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            <Prop label="Files" mono>{files.size}</Prop>
            <Prop label="Total" mono>{formatBytes(totalBytes)}</Prop>
            <Prop label="Format" mono>{mcmetaSummary.format ?? "—"}</Prop>
            {mcmetaSummary.desc && <Prop label="Description">{mcmetaSummary.desc}</Prop>}
            <Prop label="Target" mono>{mcVersion}</Prop>
          </dl>
        </aside>
      </div>

      <StatusBar
        items={[
          <span key="n">{packName}.zip</span>,
          dirty ? <span key="s" style={{ color: "var(--warn)" }}>● Unsaved</span> : <span key="s">Saved locally</span>,
          selected && <span key="f" className="truncate">{selected}</span>,
          imgDims && selIsPng ? <span key="d">{imgDims[0]}×{imgDims[1]} · {zoom * 100}%</span> : null,
          <span key="c">{files.size} files</span>,
        ]}
      />

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={ctxItems(ctx.path, ctx.isDir)}
          onClose={() => setCtx(null)}
        />
      )}
      <input ref={zipInput} type="file" accept=".zip" className="hidden" onChange={async (e) => { if (e.target.files) await importZip([...e.target.files]); e.target.value = ""; }} aria-hidden />
      <input ref={addInput} type="file" multiple className="hidden" onChange={async (e) => { if (e.target.files) await addFiles([...e.target.files]); e.target.value = ""; }} aria-hidden />
    </div>
  );
}

function Prop({ label, children, mono, breakAll }: { label: string; children: React.ReactNode; mono?: boolean; breakAll?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0" style={{ color: "var(--muted)" }}>{label}</dt>
      <dd className={`min-w-0 flex-1 ${mono ? "font-mono text-[12px]" : ""} ${breakAll ? "break-all" : "truncate"}`} title={typeof children === "string" ? children : undefined}>
        {children}
      </dd>
    </div>
  );
}

function TreeNodeView({ node, depth, expanded, toggle, selected, onSelect, onCtx }: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (p: string) => void;
  selected: string | null;
  onSelect: (p: string) => void;
  onCtx: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}) {
  return (
    <ul role={depth === 0 ? undefined : "group"}>
      {node.dirs.map((d) => {
        const open = expanded.has(d.path);
        return (
          <li key={d.path} role="treeitem" aria-expanded={open}>
            <div
              className="file-row ui-transition flex cursor-pointer items-center gap-1 rounded px-1 py-[5px]"
              data-active={false}
              style={{ paddingInlineStart: 4 + depth * 14 }}
              onClick={() => toggle(d.path)}
              onContextMenu={(e) => onCtx(e, d.path, true)}
            >
              {open
                ? <ChevronDown className="size-3.5 shrink-0" aria-hidden style={{ color: "var(--faint)" }} />
                : <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden style={{ color: "var(--faint)" }} />}
              {open
                ? <FolderOpen className="size-3.5 shrink-0" aria-hidden style={{ color: "var(--warn)" }} />
                : <Folder className="size-3.5 shrink-0" aria-hidden style={{ color: "var(--warn)" }} />}
              <span className="truncate text-[12.5px] font-medium">{d.name}</span>
            </div>
            {open && (
              <TreeNodeView node={d} depth={depth + 1} expanded={expanded} toggle={toggle} selected={selected} onSelect={onSelect} onCtx={onCtx} />
            )}
          </li>
        );
      })}
      {node.files.map((f) => {
        const Icon = fileIcon(f);
        const active = selected === f;
        return (
          <li key={f} role="treeitem" aria-selected={active}>
            <button
              onClick={() => onSelect(f)}
              onContextMenu={(e) => onCtx(e, f, false)}
              className="file-row ui-transition flex w-full items-center gap-1.5 rounded px-1 py-[5px] text-start"
              data-active={active}
              style={{ paddingInlineStart: 4 + depth * 14 + 18, color: active ? "var(--text)" : "var(--muted)" }}
              aria-current={active ? "true" : undefined}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden style={{ color: active ? "var(--accent)" : "var(--faint)" }} />
              <span className="truncate font-mono text-[12px]">{baseOf(f)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DurationProbe({ url }: { url: string }) {
  const [dur, setDur] = useState<string>("—");
  useEffect(() => {
    if (!url) return;
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => setDur(Number.isFinite(a.duration) ? `${a.duration.toFixed(2)} s` : "—");
    a.onerror = () => setDur("unavailable");
    a.src = url;
  }, [url]);
  return <span className="font-mono">{dur}</span>;
}
