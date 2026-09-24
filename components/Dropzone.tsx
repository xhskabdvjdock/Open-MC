"use client";
import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";

interface Props {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
  compact?: boolean;
}

export function Dropzone({ accept, multiple, onFiles, label, hint, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list);
    if (arr.length) onFiles(arr);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-center transition-colors ${
        compact ? "px-4 py-5" : "px-6 py-9"
      } ${over ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"}`}
    >
      <span className="grid size-9 place-items-center rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
        <Upload className="size-4" aria-hidden />
      </span>
      <span className="text-[13.5px] font-semibold">{label}</span>
      {hint && <span className="max-w-100 text-[12px] text-slate-500 dark:text-slate-400">{hint}</span>}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { handle(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
