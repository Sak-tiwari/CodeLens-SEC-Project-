import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAsync } from "./useAsync";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const DEFAULT_SETTINGS = {
  name: "Course Instructor", email: "instructor@example.edu",
  threshold: 0.75, candidate: 0.5, n: 3,
  weights: { raw: 0.1, cosine: 0.25, ngram: 0.55, length: 0.1, lcs: 0 },
};

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
}

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => document.documentElement.dataset.theme || "light");
  const [settings, setSettingsState] = useState(() => load("codelens-settings", DEFAULT_SETTINGS));
  const [aid, setAid] = useState(null);
  const [toast, setToast] = useState(null);

  const base = useAsync(async (signal) => {
    const [assignments, health] = await Promise.all([api("/api/assignments", { signal }), api("/api/health", { signal })]);
    return { assignments, health };
  }, []);
  const assignments = base.data?.assignments || [];
  useEffect(() => { if (!aid && assignments.length) setAid(assignments[0].assignment_id); }, [assignments, aid]);

  const setTheme = useCallback((t) => {
    document.documentElement.dataset.theme = t; setThemeState(t);
    try { localStorage.setItem("codelens-theme", t); } catch { /* storage blocked: still applies this visit */ }
  }, []);
  const saveSettings = useCallback((next) => {
    setSettingsState(next);
    try { localStorage.setItem("codelens-settings", JSON.stringify(next)); } catch { /* ignore */ }
    setToast("Settings saved"); setTimeout(() => setToast(null), 2500);
  }, []);

  const value = useMemo(() => ({
    theme, setTheme, settings, saveSettings, aid, setAid, assignments, health: base.data?.health,
    assignment: assignments.find((a) => a.assignment_id === aid), baseState: base, toast,
  }), [theme, setTheme, settings, saveSettings, aid, assignments, base, toast]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
