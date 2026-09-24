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
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
      className="ui-transition flex cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed text-center"
      style={{
        padding: compact ? "16px 20px" : "26px 22px",
        borderColor: over ? "var(--accent)" : "var(--border-strong)",
        background: over ? "var(--accent-soft)" : "transparent",
      }}
    >
      <span
        className="grid size-8 place-items-center rounded"
        style={{ background: "var(--text)", color: "var(--panel)" }}
        aria-hidden
      >
        <Upload className="size-4" />
      </span>
      <span className="text-[13.5px] font-semibold">{label}</span>
      {hint && <span className="max-w-[420px] text-[12px]" style={{ color: "var(--muted)" }}>{hint}</span>}
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
