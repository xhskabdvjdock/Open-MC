"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Folder, File as FileIcon, Image as ImageIcon, Music, Braces, Download, Trash2,
  Pencil, Plus, Replace, Save, ChevronRight, PackageOpen, FileUp, X,
} from "lucide-react";
import { useApp } from "@/components/Providers";
import { Dropzone } from "@/components/Dropzone";
import { PixelEditor, type PixelEditorHandle } from "@/components/PixelEditor";
import { ModelPreview, type McModel } from "@/components/ModelPreview";
import { loadZipSafely, sanitizeZipPath, sniffAudio } from "@/lib/zip-safety";
import { packFormatForVersion } from "@/lib/versions";
import { loadImage, formatBytes, downloadBlob, canvasToBlob, blobToDataUrl } from "@/lib/pixel-utils";
import { saveProject, uid } from "@/lib/storage";

type FilesMap = Map<string, Uint8Array>;

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
}
function baseOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}

export default function ResourcePackPage() {
  const { notify, mcVersion, autosave } = useApp();
  const [packName, setPackName] = useState("MyPack");
  const [files, setFiles] = useState<FilesMap>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [currentDir, setCurrentDir] = useState("");
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
  const editorRef = useRef<PixelEditorHandle>(null);
  const editedFlag = useRef(false);

  const fileList = useMemo(() => [...files.keys()].sort(), [files]);

  const dirs = useMemo(() => {
    const set = new Set<string>();
    for (const p of fileList) {
      const d = dirOf(p);
      const parts = d ? d.split("/") : [];
      let acc = "";
      for (const part of parts) {
        acc = acc ? acc + "/" + part : part;
        set.add(acc);
      }
    }
    return [...set].sort();
  }, [fileList]);

  const crumbs = useMemo(() => (currentDir ? currentDir.split("/") : []), [currentDir]);

  const visible = useMemo(() => {
    const subdirs = dirs.filter((d) => dirOf(d) === currentDir).map((d) => baseOf(d));
    const items = fileList.filter((f) => dirOf(f) === currentDir);
    return { subdirs, items };
  }, [dirs, fileList, currentDir]);

  const markDirty = useCallback(() => setDirty(true), []);

  // ---- import ----
  const importZip = useCallback(async (uploads: File[]) => {
    const f = uploads[0];
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) { notify("Only .zip resource packs are supported.", "err"); return; }
    setBusy("Reading archive…");
    try {
      const { entries } = await loadZipSafely(f);
      const next: FilesMap = new Map();
      for (const e of entries) {
        if (e.dir) continue;
        const bytes = await e.getData();
        next.set(e.path, bytes);
      }
      setFiles(next);
      setPackName(f.name.replace(/\.zip$/i, "") || "MyPack");
      setCurrentDir("");
      setSelected(null);
      setLoaded(true);
      const mc = next.get("pack.mcmeta");
      if (mc) setMcmetaText(new TextDecoder().decode(mc));
      else {
        const fmt = packFormatForVersion(mcVersion);
        setMcmetaText(JSON.stringify({ pack: { pack_format: fmt, description: `${f.name.replace(/\.zip$/i, "")} — made with Open MC` } }, null, 2));
      }
      notify(`Imported ${next.size} files`);
      markDirty();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Invalid Resource Pack", "err");
    } finally {
      setBusy("");
    }
  }, [markDirty, mcVersion, notify]);

  const newBlankPack = useCallback(() => {
    const fmt = packFormatForVersion(mcVersion);
    const mc = JSON.stringify({ pack: { pack_format: fmt, description: "My pack — made with Open MC" } }, null, 2);
    const next: FilesMap = new Map();
    next.set("pack.mcmeta", new TextEncoder().encode(mc));
    setFiles(next);
    setMcmetaText(mc);
    setPackName("MyPack");
    setCurrentDir("");
    setSelected(null);
    setLoaded(true);
    markDirty();
    notify("Blank pack created");
  }, [markDirty, mcVersion, notify]);

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
        editedFlag.current = false;
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
  const addFiles = useCallback(async (uploads: File[]) => {
    const next = new Map(files);
    let added = 0;
    for (const f of uploads) {
      const target = currentDir ? `${currentDir}/${f.name}` : f.name;
      const safe = sanitizeZipPath(target);
      if (!safe) { notify(`Rejected unsafe name: ${f.name}`, "err"); continue; }
      if (f.size > 50 * 1024 * 1024) { notify(`${f.name} is larger than 50 MB — skipped.`, "err"); continue; }
      next.set(safe, new Uint8Array(await f.arrayBuffer()));
      added++;
    }
    setFiles(next);
    if (added) { notify(`Added ${added} file${added === 1 ? "" : "s"}`); markDirty(); }
  }, [files, currentDir, markDirty, notify]);

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
      if (currentDir === path || currentDir.startsWith(path + "/")) setCurrentDir(dirOf(path));
    } else {
      next.delete(path);
    }
    setFiles(next);
    if (selected === path) setSelected(null);
    markDirty();
    notify("Deleted");
  }, [files, currentDir, selected, markDirty, notify]);

  const renamePath = useCallback((path: string, isDir: boolean) => {
    const base = isDir ? baseOf(path) : baseOf(path);
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
          const rest = k.slice(path.length);
          next.set(dest + rest, next.get(k)!);
          next.delete(k);
        }
      }
      if (currentDir === path) setCurrentDir(dest);
    } else {
      if (next.has(dest)) { notify("A file with that name already exists.", "err"); return; }
      next.set(dest, next.get(path)!);
      next.delete(path);
      if (selected === path) setSelected(dest);
    }
    setFiles(next);
    markDirty();
    notify("Renamed");
  }, [files, currentDir, selected, markDirty, notify]);

  const downloadPath = useCallback((path: string) => {
    const bytes = files.get(path);
    if (!bytes) return;
    const mime = /\.png$/i.test(path) ? "image/png" : /\.json$/i.test(path) ? "application/json" : "application/octet-stream";
    downloadBlob(new Blob([bytes as BlobPart], { type: mime }), baseOf(path));
    notify("Downloaded");
  }, [files, notify]);

  const createFolder = useCallback(() => {
    const name = prompt("Folder name:");
    if (!name) return;
    if (/[/\\]/.test(name)) { notify("Folder name must not contain slashes.", "err"); return; }
    setCurrentDir((d) => (d ? `${d}/${name}` : name));
    notify("Folder created");
  }, [notify]);

  // ---- mcmeta ----
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
    } catch (e) {
      setMcmetaError(e instanceof Error ? e.message : "Invalid JSON");
      notify("Invalid JSON — not saved.", "err");
    }
  }, [mcmetaText, files, markDirty, notify]);

  // ---- texture apply ----
  const applyTextureEdit = useCallback(async () => {
    if (!selected || !editorRef.current) return;
    const blob = await editorRef.current.getBlob();
    if (!blob) { notify("Export failed", "err"); return; }
    const next = new Map(files);
    next.set(selected, new Uint8Array(await blob.arrayBuffer()));
    setFiles(next);
    markDirty();
    notify("Texture saved");
  }, [selected, files, markDirty, notify]);

  // ---- export ----
  const exportZip = useCallback(async () => {
    if (!files.size) { notify("Nothing to export.", "err"); return; }
    // Validate mcmeta before export
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

  const saveModelJson = useCallback(() => {
    if (!selected) return;
    try {
      const parsed = JSON.parse(modelText);
      setModelError("");
      const next = new Map(files);
      next.set(selected, new TextEncoder().encode(JSON.stringify(parsed, null, 2)));
      setFiles(next);
      setModelText(JSON.stringify(parsed, null, 2));
      markDirty();
      notify("Model saved");
    } catch (e) {
      setModelError(e instanceof Error ? e.message : "Invalid JSON");
      notify("Invalid JSON — not saved.", "err");
    }
  }, [selected, modelText, files, markDirty, notify]);

  const saveTextFile = saveModelJson;

  if (!loaded) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Resource Pack Studio</h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400">Import a <span className="font-mono">.zip</span> — everything is read locally in your browser. <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-slate-700">Local</span></p>
        </div>
        <Dropzone accept=".zip" onFiles={importZip} label="Drop a resource pack .zip here or click to browse" hint="Parsed locally · path traversal rejected · archives over 500 MB / 8000 files rejected (ZIP-bomb protection)" />
        <div className="flex items-center gap-2">
          <button onClick={newBlankPack} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700">
            <Plus className="size-4" aria-hidden /> New blank pack
          </button>
          {busy && <span className="text-[13px] text-slate-500">{busy}</span>}
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3 text-[12.5px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Expected structure: <code>pack.mcmeta</code>, <code>pack.png</code>, <code>assets/minecraft/textures/…</code>
        </div>
      </div>
    );
  }

  const selIsPng = selected ? /\.png$/i.test(selected) : false;
  const selIsJson = selected ? /\.json$/i.test(selected) : false;
  const selIsAudio = selected ? /\.(ogg|wav|mp3)$/i.test(selected) : false;
  const selIsText = selected ? /\.(txt|mcmeta|lang|properties)$/i.test(selected) && !selIsJson : false;

  return (
    <div className="flex flex-col gap-3">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2">
        <PackageOpen className="size-5 text-emerald-600" aria-hidden />
        <input
          value={packName}
          onChange={(e) => { setPackName(e.target.value); markDirty(); }}
          aria-label="Pack name"
          className="w-52 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[14px] font-bold dark:border-slate-700 dark:bg-slate-900"
        />
        <span className="text-[12px] text-slate-500 dark:text-slate-400">{files.size} files{dirty ? " · unsaved changes" : " · saved locally"}</span>
        <span className="ms-auto flex items-center gap-1.5">
          <button onClick={exportZip} disabled={!!busy} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <Download className="size-4" aria-hidden /> Export Resource Pack
          </button>
          <button onClick={() => { setLoaded(false); setFiles(new Map()); setSelected(null); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-[13px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Close
          </button>
        </span>
      </div>
      {busy && <p className="text-[12.5px] text-slate-500" role="status">{busy}</p>}

      {/* breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] dark:border-slate-700 dark:bg-slate-900">
        <button onClick={() => setCurrentDir("")} className="font-semibold text-emerald-600 hover:underline">{packName}</button>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
            <button onClick={() => setCurrentDir(crumbs.slice(0, i + 1).join("/"))} className="hover:underline">{c}</button>
          </React.Fragment>
        ))}
        <span className="ms-auto flex items-center gap-1">
          <button onClick={createFolder} className="flex items-center gap-1 rounded px-2 py-1 text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800"><Plus className="size-3.5" aria-hidden /> Folder</button>
          <label className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800">
            <FileUp className="size-3.5" aria-hidden /> Add files
            <input type="file" multiple className="hidden" onChange={async (e) => { if (e.target.files) await addFiles([...e.target.files]); e.target.value = ""; }} />
          </label>
        </span>
      </nav>

      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        {/* explorer */}
        <section aria-label="File explorer" className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Explorer — {currentDir || "/"}
          </div>
          <ul className="max-h-[480px] overflow-y-auto p-1.5">
            {currentDir && (
              <li>
                <button onClick={() => setCurrentDir(dirOf(currentDir))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Folder className="size-4 text-slate-400" aria-hidden /> ..
                </button>
              </li>
            )}
            {visible.subdirs.map((d) => {
              const full = currentDir ? `${currentDir}/${d}` : d;
              return (
                <li key={full} className="group flex items-center gap-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                  <button onClick={() => setCurrentDir(full)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-start text-[13px]">
                    <Folder className="size-4 shrink-0 text-amber-500" aria-hidden />
                    <span className="truncate font-medium">{d}</span>
                  </button>
                  <span className="hidden gap-0.5 pe-1 group-hover:flex">
                    <button onClick={() => renamePath(full, true)} aria-label={`Rename ${d}`} title="Rename" className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"><Pencil className="size-3.5" aria-hidden /></button>
                    <button onClick={() => deletePath(full, true)} aria-label={`Delete ${d}`} title="Delete" className="rounded p-1 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"><Trash2 className="size-3.5" aria-hidden /></button>
                  </span>
                </li>
              );
            })}
            {visible.items.map((f) => {
              const isImg = /\.png$/i.test(f);
              const isAud = /\.(ogg|wav|mp3)$/i.test(f);
              const isJson = /\.json$/i.test(f) || f === "pack.mcmeta";
              const Icon = isImg ? ImageIcon : isAud ? Music : isJson ? Braces : FileIcon;
              const active = selected === f;
              return (
                <li key={f} className={`group flex items-center gap-1 rounded ${active ? "bg-emerald-600/10" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                  <button onClick={() => openPath(f)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-start text-[13px]" aria-current={active ? "true" : undefined}>
                    <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="truncate font-mono text-[12.5px]">{baseOf(f)}</span>
                    <span className="ms-auto shrink-0 text-[10.5px] text-slate-400">{formatBytes(files.get(f)?.length ?? 0)}</span>
                  </button>
                  <span className="hidden gap-0.5 pe-1 group-hover:flex">
                    <button onClick={() => downloadPath(f)} aria-label={`Download ${baseOf(f)}`} title="Download" className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"><Download className="size-3.5" aria-hidden /></button>
                    <button onClick={() => renamePath(f, false)} aria-label={`Rename ${baseOf(f)}`} title="Rename" className="rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-700"><Pencil className="size-3.5" aria-hidden /></button>
                    <button onClick={() => deletePath(f, false)} aria-label={`Delete ${baseOf(f)}`} title="Delete" className="rounded p-1 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"><Trash2 className="size-3.5" aria-hidden /></button>
                  </span>
                </li>
              );
            })}
            {visible.subdirs.length === 0 && visible.items.length === 0 && (
              <li className="px-2 py-6 text-center text-[12.5px] text-slate-500">Empty folder. Add files above.</li>
            )}
          </ul>
        </section>

        {/* editor panel */}
        <section aria-label="Editor" className="min-w-0 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          {!selected && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <h2 className="mb-1 text-[13px] font-bold">pack.mcmeta</h2>
                <textarea
                  value={mcmetaText}
                  onChange={(e) => { setMcmetaText(e.target.value); setMcmetaError(""); }}
                  rows={10}
                  spellCheck={false}
                  aria-label="pack.mcmeta JSON"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12px] dark:border-slate-700 dark:bg-slate-950"
                />
                {mcmetaError && <p className="mt-1 text-[12px] text-red-600" role="alert">{mcmetaError}</p>}
                <button onClick={saveMcmeta} className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
                  <Save className="size-4" aria-hidden /> Save pack.mcmeta
                </button>
              </div>
              <div className="text-[12.5px] text-slate-600 dark:text-slate-300">
                <h2 className="mb-1 text-[13px] font-bold text-slate-900 dark:text-slate-100">How to work</h2>
                <ol className="list-inside list-decimal space-y-1">
                  <li>Browse folders on the left.</li>
                  <li>Click a <span className="font-mono">.png</span> to pixel-edit it.</li>
                  <li>Click a <span className="font-mono">.json</span> model to validate + preview.</li>
                  <li>Click a sound to play it and see format info.</li>
                  <li>Export produces a real <span className="font-mono">.zip</span> with the same structure.</li>
                </ol>
                <p className="mt-2 rounded border border-slate-200 p-2 dark:border-slate-700">Target version: <span className="font-mono font-bold">{mcVersion}</span> (change in Settings or Version Tools).</p>
              </div>
            </div>
          )}

          {selected && (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 font-mono text-[12px] dark:bg-slate-800">{selected}</code>
                <label className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[12px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <Replace className="size-3.5" aria-hidden /> Replace
                  <input type="file" className="hidden" onChange={async (e) => { if (e.target.files) await replaceSelected([...e.target.files]); e.target.value = ""; }} />
                </label>
                <button onClick={() => downloadPath(selected)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[12px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <Download className="size-3.5" aria-hidden /> Download
                </button>
                <button onClick={() => { setSelected(null); }} aria-label="Close file" className="rounded-md border border-slate-200 p-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              {selIsPng && editingImg && imgDims && (
                <div className="grid gap-3 xl:grid-cols-2">
                  <PixelEditor
                    key={selected + editKey}
                    ref={editorRef}
                    width={imgDims[0]}
                    height={imgDims[1]}
                    initialImage={editingImg}
                    onEdit={() => { editedFlag.current = true; }}
                  />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-bold">Texture preview</h3>
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt={`Preview of ${selected}`} className="max-h-56 w-auto self-start rounded border border-slate-200 bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:16px_16px] dark:border-slate-700" style={{ imageRendering: "pixelated" }} />
                    )}
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">{imgDims[0]}×{imgDims[1]} px · {formatBytes(files.get(selected)?.length ?? 0)}</p>
                    <button onClick={applyTextureEdit} className="flex w-fit items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
                      <Save className="size-4" aria-hidden /> Apply texture edit
                    </button>
                    <p className="text-[11.5px] text-slate-500">Edits stay pixel-perfect (nearest-neighbor only, alpha preserved). Apply writes back into the pack.</p>
                  </div>
                </div>
              )}

              {(selIsJson || selected === "pack.mcmeta") && (
                <div className="grid gap-3 xl:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-[13px] font-bold">{selected === "pack.mcmeta" ? "pack.mcmeta" : "Model JSON"}</h3>
                      <button
                        onClick={() => {
                          try {
                            const t = selected === "pack.mcmeta" ? mcmetaText : modelText;
                            const fmt = JSON.stringify(JSON.parse(t), null, 2);
                            if (selected === "pack.mcmeta") setMcmetaText(fmt); else setModelText(fmt);
                          } catch { notify("Invalid JSON — cannot format.", "err"); }
                        }}
                        className="rounded border border-slate-200 px-2 py-0.5 text-[12px] hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      >
                        Format
                      </button>
                    </div>
                    <textarea
                      value={selected === "pack.mcmeta" ? mcmetaText : modelText}
                      onChange={(e) => { if (selected === "pack.mcmeta") setMcmetaText(e.target.value); else setModelText(e.target.value); }}
                      rows={18}
                      spellCheck={false}
                      aria-label={`Edit ${selected}`}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12px] dark:border-slate-700 dark:bg-slate-950"
                    />
                    {(modelError || mcmetaError) && <p className="mt-1 text-[12px] text-red-600" role="alert">{modelError || mcmetaError}</p>}
                    <button onClick={selected === "pack.mcmeta" ? saveMcmeta : saveModelJson} className="mt-2 flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
                      <Save className="size-4" aria-hidden /> Save JSON
                    </button>
                  </div>
                  <div>
                    <h3 className="mb-1 text-[13px] font-bold">3D preview</h3>
                    {parsedModel ? <ModelPreview model={parsedModel} /> : <p className="text-[12.5px] text-red-600">Invalid JSON — fix syntax to preview.</p>}
                  </div>
                </div>
              )}

              {selIsAudio && (
                <div className="flex flex-col gap-2">
                  <dl className="grid max-w-lg grid-cols-[110px_1fr] gap-1 rounded-md border border-slate-200 p-3 text-[12.5px] dark:border-slate-700">
                    <dt className="text-slate-500">Filename</dt><dd className="font-mono">{baseOf(selected)}</dd>
                    <dt className="text-slate-500">Path</dt><dd className="font-mono break-all">{selected}</dd>
                    <dt className="text-slate-500">Size</dt><dd>{formatBytes(audioMeta?.size ?? 0)}</dd>
                    <dt className="text-slate-500">Format</dt><dd className="font-mono">{audioMeta?.format ?? "unknown"}</dd>
                    <dt className="text-slate-500">Duration</dt>
                    <dd>
                      <DurationProbe url={soundUrls[selected] ?? previewUrl} />
                    </dd>
                  </dl>
                  {(soundUrls[selected] ?? previewUrl) && (
                    <audio controls src={soundUrls[selected] ?? previewUrl} className="w-full max-w-lg" preload="metadata" />
                  )}
                  <p className="text-[11.5px] text-slate-500">Sounds are never converted. Replace/Delete/Add/Download preserve bytes exactly.</p>
                </div>
              )}

              {selIsText && (
                <div>
                  <textarea value={modelText} onChange={(e) => setModelText(e.target.value)} rows={18} spellCheck={false} aria-label={`Edit ${selected}`} className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12px] dark:border-slate-700 dark:bg-slate-950" />
                  <button onClick={saveTextFile} className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Save file</button>
                </div>
              )}

              {!selIsPng && !selIsJson && !selIsAudio && !selIsText && selected !== "pack.mcmeta" && (
                <p className="text-[13px] text-slate-500">Binary file ({formatBytes(files.get(selected)?.length ?? 0)}). Use Replace or Download.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
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

// keep canvasToBlob import used (pack.png quick ops reuse texture path)
void canvasToBlob;
void blobToDataUrl;
