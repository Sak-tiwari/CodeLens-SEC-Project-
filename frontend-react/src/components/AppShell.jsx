import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Code2, LayoutDashboard, Menu, Moon, Network, Settings, Sun, TriangleAlert, X } from "lucide-react";
import { useApp } from "../lib/app-context";
import { IconButton, Select, cx } from "./ui";

export const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workspace", label: "Similarity workspace", icon: Network },
  { id: "settings", label: "Settings", icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-brand text-on-brand"><Code2 className="size-5" aria-hidden="true" /></span>
      <div className="leading-tight"><p className="font-bold tracking-tight">CodeLens</p><p className="text-xs text-muted">Assessment &amp; similarity</p></div>
    </div>
  );
}

function SidebarNav({ route, go, onNavigate }) {
  const { health } = useApp();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => {
          const on = route === id;
          return (
            <a key={id} href={`#${id}`} aria-current={on ? "page" : undefined}
              onClick={() => { go(id); onNavigate?.(); }}
              className={cx("flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors duration-150",
                on ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink")}>
              <Icon className="size-[18px]" aria-hidden="true" />{label}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto rounded-xl border border-line bg-surface-2 p-3 text-sm">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Compiler</p>
        {health?.gcc
          ? <p className="flex items-center gap-2 font-semibold text-success"><CheckCircle2 className="size-4" aria-hidden="true" />GCC ready</p>
          : <p className="flex items-center gap-2 font-semibold text-warning"><TriangleAlert className="size-4" aria-hidden="true" />{health ? "GCC not found" : "Checking…"}</p>}
      </div>
    </div>
  );
}

export function AppShell({ route, go, children }) {
  const { theme, setTheme, assignments, aid, setAid } = useApp();
  const [open, setOpen] = useState(false);
  const firstLink = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:font-bold focus:text-on-brand">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block"><SidebarNav route={route} go={go} /></aside>

      {/* Tablet / mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <div className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Navigation" className="animate-slide-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-surface shadow-pop">
            <div className="absolute right-2 top-2"><IconButton icon={X} label="Close menu" onClick={() => setOpen(false)} /></div>
            <SidebarNav route={route} go={go} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
          <IconButton icon={Menu} label="Open menu" className="lg:hidden" aria-expanded={open} onClick={() => { setOpen(true); }} ref={firstLink} />
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-muted">
              <span className="hidden sm:inline">Assignment</span>
              <Select value={aid ?? ""} onChange={(e) => setAid(+e.target.value)} aria-label="Assignment" className="max-w-[200px] sm:max-w-[260px]">
                {assignments.map((a) => <option key={a.assignment_id} value={a.assignment_id}>{a.title}</option>)}
              </Select>
            </label>
            <IconButton icon={theme === "dark" ? Sun : Moon} label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 pb-16 outline-none sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
