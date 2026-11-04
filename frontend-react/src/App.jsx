import { useCallback, useEffect, useState } from "react";
import { AppProvider, useApp } from "./lib/app-context";
import { AppShell, NAV } from "./components/AppShell";
import { Inbox } from "lucide-react";
import { ErrorBanner, SkeletonRows, Card, EmptyState } from "./components/ui";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./views/Dashboard";
import Workspace from "./views/Workspace";
import SettingsView from "./views/Settings";

const VIEWS = { dashboard: Dashboard, workspace: Workspace, settings: SettingsView };
const fromHash = () => { const h = location.hash.slice(1); return VIEWS[h] ? h : "dashboard"; };

function Routes() {
  const { baseState, aid, toast, assignments } = useApp();
  const [route, setRoute] = useState(fromHash);
  useEffect(() => { const f = () => setRoute(fromHash()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  const go = useCallback((id) => { location.hash = id; setRoute(id); }, []);
  useEffect(() => { document.title = `${NAV.find((n) => n.id === route)?.label} · CodeLens`; }, [route]);

  const View = VIEWS[route];
  return (
    <AppShell route={route} go={go}>
      {baseState.error ? <ErrorBanner error={baseState.error} onRetry={baseState.reload} />
        : baseState.loading || (!aid && assignments.length && route !== "settings") ? <Card><SkeletonRows rows={5} /></Card>
        : !assignments.length && route !== "settings" ? <Card><EmptyState icon={Inbox} title="No assignments yet" text="Seed the demo data or create an assignment through the API to get started." /></Card>
        : <ErrorBoundary resetKey={route}><View go={go} /></ErrorBoundary>}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {toast && <p className="animate-rise rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-bg shadow-pop">{toast}</p>}
      </div>
    </AppShell>
  );
}

export default function App() { return <AppProvider><Routes /></AppProvider>; }
