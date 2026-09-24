"use client";
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/* ——— Open MC component system ———
   Single source of truth for primitives. Flat panels, 1px borders,
   compact controls. No decorative cards. */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border px-1 py-px font-mono text-[10.5px] leading-none"
      style={{ borderColor: "var(--border-strong)", background: "var(--panel-2)", color: "var(--muted)" }}>
      {children}
    </kbd>
  );
}

export function IconBtn({ label, onClick, active, disabled, danger, children, shortcut }: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      className="ui-transition grid size-8 shrink-0 place-items-center rounded disabled:opacity-35"
      style={{
        color: danger ? "var(--danger)" : active ? "var(--accent)" : "var(--muted)",
        background: active ? "var(--accent-soft)" : "transparent",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

export function Btn({ children, onClick, primary, danger, disabled, title, type }: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="ui-transition flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50"
      style={
        primary
          ? { background: "var(--accent)", color: "#fff" }
          : danger
            ? { border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent" }
            : { border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)" }
      }
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--faint)" }}>
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Panel({ title, right, children, pad = true, className = "" }: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
  className?: string;
}) {
  return (
    <section
      className={className}
      style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--panel)" }}
    >
      {title && (
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[13px] font-bold">{title}</h2>
          {right}
        </header>
      )}
      <div className={pad ? "p-3" : ""}>{children}</div>
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-[13px] font-semibold">
      {label}
      <span className="mt-1 block font-normal">{children}</span>
      {hint && <span className="mt-0.5 block text-[11.5px] font-normal" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded border px-2.5 py-[7px] text-[13px] outline-none ui-transition";

export function inputStyle(): React.CSSProperties {
  return { borderColor: "var(--border)", background: "var(--panel)" };
}

export function Tabs<T extends string>({ tabs, active, onChange, ariaLabel }: {
  tabs: { id: T; label: React.ReactNode }[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-0.5 border-b" style={{ borderColor: "var(--border)" }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className="ui-transition -mb-px border-b-2 px-3 py-1.5 text-[13px]"
          style={{
            borderColor: active === t.id ? "var(--accent)" : "transparent",
            color: active === t.id ? "var(--text)" : "var(--muted)",
            fontWeight: active === t.id ? 700 : 400,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({ title, onClose, children, width = 440 }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("input, select, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        ref={box}
        className="relative w-full"
        style={{ maxWidth: width, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-pop)" }}
      >
        <header className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[14px] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="ui-transition rounded p-1 hover:opacity-70" style={{ color: "var(--muted)" }}><X className="size-4" aria-hidden /></button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
      {icon && <span style={{ color: "var(--faint)" }}>{icon}</span>}
      <p className="text-[13.5px] font-bold">{title}</p>
      {body && <p className="max-w-80 text-[12.5px]" style={{ color: "var(--muted)" }}>{body}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export function StatusBar({ items }: { items: (React.ReactNode | null | false)[] }) {
  return (
    <footer
      className="flex items-center gap-3 overflow-x-auto whitespace-nowrap border-t px-3 py-1 font-mono text-[11px]"
      style={{ borderColor: "var(--border)", background: "var(--panel)", color: "var(--muted)" }}
      aria-label="Status"
    >
      {items.filter(Boolean).map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span aria-hidden style={{ color: "var(--border-strong)" }}>|</span>}
          <span className="flex items-center gap-1.5">{it}</span>
        </React.Fragment>
      ))}
    </footer>
  );
}

/* Right-click context menu */
export interface CtxItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function ContextMenu({ x, y, items, onClose }: {
  x: number; y: number; items: CtxItem[]; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({
        x: Math.min(x, window.innerWidth - r.width - 8),
        y: Math.min(y, window.innerHeight - r.height - 8),
      });
    }
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("blur", close); window.removeEventListener("keydown", onKey); };
  }, [x, y, onClose]);
  return (
    <>
      <div className="fixed inset-0 z-[94]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        role="menu"
        className="fixed z-[95] min-w-44 py-1"
        style={{ left: pos.x, top: pos.y, background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-pop)" }}
      >
        {items.map((it, i) => (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => { onClose(); it.onSelect(); }}
            className="ui-transition flex w-full items-center gap-2 px-3 py-[7px] text-start text-[13px] disabled:opacity-40"
            style={{ color: it.danger ? "var(--danger)" : "var(--text)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--panel-2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
          >
            {it.icon && <span className="size-4 shrink-0">{it.icon}</span>}
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* Horizontal drag resizer between flex panels */
export function Resizer({ onResize }: { onResize: (dx: number) => void }) {
  const drag = useRef<{ x: number } | null>(null);
  const [active, setActive] = useState(false);
  return (
    <div
      className="resizer self-stretch"
      data-drag={active}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX };
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const rtl = document.documentElement.dir === "rtl";
        const dx = (e.clientX - drag.current.x) * (rtl ? -1 : 1);
        drag.current = { x: e.clientX };
        onResize(dx);
      }}
      onPointerUp={() => { drag.current = null; setActive(false); }}
      onPointerCancel={() => { drag.current = null; setActive(false); }}
    />
  );
}

/* Collapsed-sidebar / icon tooltip (RTL-aware via logical inset) */
export function Tip({ label, shortcut, children }: {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="group/tip relative flex">
      {children}
      <span
        role="tooltip"
        className="ui-transition pointer-events-none absolute top-1/2 z-[80] flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-[12px] opacity-0 group-hover/tip:opacity-100"
        style={{
          insetInlineStart: "calc(100% + 10px)",
          background: "var(--panel)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
    </span>
  );
}
