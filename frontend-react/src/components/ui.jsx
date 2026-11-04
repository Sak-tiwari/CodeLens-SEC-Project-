import { forwardRef, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { STATUS } from "../lib/status";

export const cx = (...c) => c.filter(Boolean).join(" ");

/* ───────── Button: 44px target, hover lift, press scale ───────── */
const VARIANTS = {
  primary: "bg-brand text-on-brand border-brand hover:bg-brand-hover hover:border-brand-hover",
  secondary: "bg-surface text-ink border-line-strong hover:bg-surface-2 hover:border-brand-line",
  ghost: "bg-transparent text-ink-2 border-transparent hover:bg-surface-2",
};
export function Button({ variant = "secondary", size = "md", icon: Icon, children, className, ...rest }) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold whitespace-nowrap select-none",
        "transition duration-150 ease-out-soft hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
        "disabled:opacity-60 disabled:pointer-events-none",
        size === "sm" ? "min-h-9 px-3 text-sm" : "min-h-11 px-4 text-sm",
        VARIANTS[variant], className,
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

export const IconButton = forwardRef(function IconButton({ icon: Icon, label, className, ...rest }, ref) {
  return (
    <button
      {...rest} ref={ref} aria-label={label} title={label}
      className={cx("inline-grid size-11 place-items-center rounded-[10px] border border-line-strong bg-surface text-ink-2",
        "transition duration-150 hover:bg-surface-2 active:scale-95", className)}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
});

/* ───────── Card, StatCard ───────── */
export function Card({ className, as: Tag = "section", children, ...rest }) {
  return <Tag {...rest} className={cx("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</Tag>;
}
export function CardHeader({ title, hint, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
const ACCENT = { brand: "before:bg-brand", success: "before:bg-success-solid", warning: "before:bg-warning-solid", info: "before:bg-info-solid", danger: "before:bg-danger-solid" };
export function StatCard({ label, value, hint, icon: Icon, accent = "brand", loading }) {
  return (
    <Card className={cx("relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-pop",
      "before:absolute before:inset-y-0 before:left-0 before:w-1", ACCENT[accent])}>
      <div className="flex items-center justify-between text-sm font-medium text-muted">
        <span>{label}</span>{Icon && <Icon className="size-4" aria-hidden="true" />}
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</p>}
      {hint && !loading && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </Card>
  );
}

/* ───────── Badges ───────── */
export function StatusBadge({ status }) {
  const s = STATUS[status]; if (!s) return <Badge>{status || "—"}</Badge>;
  const Icon = s.icon;
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.bg, s.text)}>
    <Icon className="size-3.5" aria-hidden="true" />{s.label}</span>;
}
const TONES = { neutral: "bg-surface-2 text-muted border border-line", brand: "bg-brand-soft text-brand", warning: "bg-warning-bg text-warning" };
export function Badge({ tone = "neutral", children }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>{children}</span>;
}

/* ───────── Loading / empty / error ───────── */
export const Skeleton = ({ className }) => <div className={cx("skeleton", className)} aria-hidden="true" />;
export function SkeletonRows({ rows = 4 }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-brand-soft text-brand"><Icon className="size-6" aria-hidden="true" /></span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorBanner({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-danger-solid/40 bg-danger-bg px-4 py-3 text-danger">
      <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-medium">{error?.message || "Something went wrong."}</p>
      {onRetry && <Button size="sm" icon={RefreshCw} onClick={onRetry}>Retry</Button>}
    </div>
  );
}

/* ───────── Page header ───────── */
export function PageHeader({ kicker, title, text, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker && <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand">{kicker}</p>}
        <h1 className="text-3xl font-bold">{title}</h1>
        {text && <p className="mt-1 max-w-2xl text-muted">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/* ───────── Labelled controls ───────── */
export function Field({ label, hint, error, children }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-2">{label}</label>
      {children(id, { "aria-invalid": !!error, "aria-describedby": error ? `${id}-e` : hint ? `${id}-h` : undefined })}
      {error ? <p id={`${id}-e`} className="mt-1.5 text-sm font-medium text-danger">{error}</p>
        : hint && <p id={`${id}-h`} className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}
export const inputCls = "min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm aria-[invalid=true]:border-danger-solid";
export function Select({ className, children, ...rest }) {
  return <select {...rest} className={cx(inputCls, "pr-8", className)}>{children}</select>;
}

/* ───────── Tabs (WAI-ARIA tabs pattern with arrow-key navigation) ───────── */
export function Tabs({ tabs, value, onChange, label }) {
  const refs = useRef([]);
  const onKey = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (e.key === "Home" || e.key === "End") { e.preventDefault(); const j = e.key === "Home" ? 0 : tabs.length - 1; onChange(tabs[j].id); refs.current[j]?.focus(); }
    if (!d) return; e.preventDefault();
    const j = (i + d + tabs.length) % tabs.length; onChange(tabs[j].id); refs.current[j]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => {
        const on = t.id === value, Icon = t.icon;
        return (
          <button key={t.id} ref={(el) => (refs.current[i] = el)} role="tab" id={`tab-${t.id}`} aria-selected={on} aria-controls={`panel-${t.id}`}
            tabIndex={on ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}
            className={cx("-mb-px inline-flex min-h-11 items-center gap-2 border-b-[3px] px-4 text-sm font-semibold whitespace-nowrap transition-colors",
              on ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}>
            {Icon && <Icon className="size-4" aria-hidden="true" />}{t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────── Drawer / dialog (focus moves in, Escape closes, focus returns) ───────── */
export function Drawer({ open, onClose, title, children, width = "max-w-5xl" }) {
  const closeRef = useRef(null), prev = useRef(null);
  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement; closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev.current?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: an ancestor with a transform animation would otherwise become the containing block of `fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={title}
        className={cx("animate-slide-in flex h-full w-full flex-col border-l border-line bg-surface shadow-pop", width)}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <IconButton ref={closeRef} icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
