import { useEffect, useMemo, useState } from "react";
import { GitCompare, RefreshCw, SearchX, ShieldCheck } from "lucide-react";
import { api, analysisQuery } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useAsync } from "../lib/useAsync";
import Heatmap from "../components/Heatmap";
import PairDrawer from "../components/PairDrawer";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, PageHeader, Select, Skeleton, SkeletonRows, StatCard, cx } from "../components/ui";

const COMP_COLORS = ["#6366f1", "#0d9488", "#ea580c", "#db2777", "#65a30d", "#0284c7", "#9333ea", "#ca8a04"];

export default function Workspace({ go }) {
  const { aid, assignment, settings } = useApp();
  const [p, setP] = useState({ threshold: settings.threshold, candidate: settings.candidate, n: settings.n, weights: settings.weights });
  const [debounced, setDebounced] = useState(p);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [comp, setComp] = useState(null); // component index filter
  const [pair, setPair] = useState(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(p), 180); return () => clearTimeout(t); }, [p]);
  const q = analysisQuery(debounced);
  const res = useAsync((signal) => api(`/api/assignments/${aid}/analysis?${q}`, { signal }), [aid, q]);
  const a = res.data;

  const compOf = useMemo(() => { const m = {}; a?.components.forEach((c, i) => c.nodes.forEach((id) => (m[id] = i))); return m; }, [a]);
  const name = (id) => a?.submissions.find((s) => s.id === id)?.label || `#${id}`;
  const rows = useMemo(() => (a?.pairs || []).filter((x) => (!flaggedOnly || x.above) && (comp == null || (compOf[x.a] === comp && compOf[x.b] === comp))).slice(0, flaggedOnly || comp != null ? 200 : 15), [a, flaggedOnly, comp, compOf]);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader kicker="Core workspace" title="Similarity analysis" text={assignment ? `${assignment.title} · structural similarity for human review, not proof of plagiarism.` : undefined} />

      {/* Toolbar */}
      <Card as="div" className="flex flex-wrap items-end gap-x-8 gap-y-4 p-4 sm:p-5" role="group" aria-label="Analysis controls">
        <label className="min-w-[220px] flex-1 text-sm font-semibold text-ink-2">
          <span className="mb-1 flex justify-between"><span>Edge threshold</span><output className="tabular-nums text-brand">{p.threshold.toFixed(2)}</output></span>
          <input type="range" min="0.3" max="1" step="0.01" value={p.threshold} onChange={(e) => setP({ ...p, threshold: +e.target.value })} className="h-11 w-full cursor-pointer accent-brand" />
        </label>
        <label className="min-w-[180px] flex-1 text-sm font-semibold text-ink-2">
          <span className="mb-1 flex justify-between"><span>Length filter</span><output className="tabular-nums text-brand">{p.candidate.toFixed(2)}</output></span>
          <input type="range" min="0" max="1" step="0.05" value={p.candidate} onChange={(e) => setP({ ...p, candidate: +e.target.value })} className="h-11 w-full cursor-pointer accent-brand" />
        </label>
        <label className="text-sm font-semibold text-ink-2">
          <span className="mb-1 block">n-gram size</span>
          <Select value={p.n} onChange={(e) => setP({ ...p, n: +e.target.value })} className="w-24">{[2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>
        </label>
        <Button icon={RefreshCw} onClick={res.reload} disabled={res.loading}>Recompute</Button>
      </Card>

      {res.error && <ErrorBanner error={res.error} onRetry={res.reload} />}

      {!a && res.loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : a && a.submissions.length < 2 ? (
        <Card><EmptyState icon={SearchX} title="Not enough submissions" text="Similarity needs at least two submissions in this assignment."
          action={<Button variant="primary" onClick={() => go("dashboard")}>Back to dashboard</Button>} /></Card>
      ) : a && (
        <div className={cx("space-y-6 transition-opacity", res.loading && "opacity-70")} aria-busy={res.loading}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Vertices / edges" value={`${a.graph_stats.vertices} / ${a.graph_stats.edges}`} />
            <StatCard label="Components" value={a.graph_stats.components} accent="success" hint={`largest: ${a.graph_stats.largest_component}`} />
            <StatCard label="Filtered out" value={a.stats.filtered_pairs} accent="warning" hint={`of ${a.stats.total_pairs} pairs`} />
            <StatCard label="Mean ± σ" value={`${a.stats.mean.toFixed(2)} ± ${a.stats.std_dev.toFixed(2)}`} accent="info" hint={`${a.stats.unusual} pairs with z > 2`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card>
              <CardHeader title="Similarity matrix" hint="Stronger colour = more similar." />
              <div className="p-5"><Heatmap data={a} onPick={(x, y) => setPair({ a: x, b: y, z: a.pairs.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x))?.z })} /></div>
            </Card>

            {/* Sidebar: connected components act as filters */}
            <Card>
              <CardHeader title="Clusters" hint="Connected components found with BFS/DFS" />
              <ul className="divide-y divide-line">
                <li><button aria-pressed={comp == null} onClick={() => setComp(null)} className={cx("flex min-h-12 w-full items-center justify-between px-5 text-sm font-semibold transition-colors hover:bg-surface-2", comp == null && "bg-brand-soft text-brand")}>All submissions<Badge>{a.submissions.length}</Badge></button></li>
                {a.components.map((c, i) => (
                  <li key={i}>
                    <button aria-pressed={comp === i} onClick={() => setComp(comp === i ? null : i)}
                      className={cx("flex min-h-12 w-full items-center gap-3 px-5 py-2 text-left text-sm transition-colors hover:bg-surface-2", comp === i && "bg-brand-soft")}>
                      <span className="size-3 shrink-0 rounded-full" style={{ background: COMP_COLORS[i % COMP_COLORS.length] }} aria-hidden="true" />
                      <span className="min-w-0 flex-1"><span className="block font-semibold">Cluster {i + 1}</span><span className="block truncate text-xs text-muted">{c.nodes.map(name).join(", ")}</span></span>
                      <Badge>{c.nodes.length}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title="Ranked pairs" hint={comp != null ? `Cluster ${comp + 1} only` : "Strongest similarity first"}
              action={<label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink-2"><input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} className="size-5 accent-brand" />Flagged only</label>} />
            {rows.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No pairs to show" text={flaggedOnly ? "No pair reaches the threshold. Lower it with the slider above." : "This cluster has no pairs."}
                action={flaggedOnly ? <Button variant="primary" onClick={() => setP({ ...p, threshold: Math.max(0.3, +(p.threshold - 0.1).toFixed(2)) })}>Lower threshold by 0.10</Button> : <Button variant="primary" onClick={() => setComp(null)}>Show all clusters</Button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th scope="col" className="px-5 py-3 font-bold">Pair</th><th scope="col" className="px-5 py-3 font-bold">Composite</th>
                    <th scope="col" className="px-5 py-3 text-right font-bold">z</th><th scope="col" className="px-5 py-3 font-bold">Flags</th><th scope="col" className="px-5 py-3"><span className="sr-only">Action</span></th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={`${r.a}-${r.b}`} className="transition-colors hover:bg-surface-2">
                        <th scope="row" className="whitespace-nowrap px-5 py-3 text-left font-semibold">{name(r.a)} <span className="text-muted">↔</span> {name(r.b)}</th>
                        <td className="px-5 py-3"><div className="flex w-44 items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true"><div className="h-full rounded-full bg-brand" style={{ width: `${r.composite * 100}%` }} /></div><b className="w-10 text-right tabular-nums">{r.composite.toFixed(2)}</b></div></td>
                        <td className="px-5 py-3 text-right tabular-nums">{r.z != null ? r.z.toFixed(1) : "–"}</td>
                        <td className="px-5 py-3"><div className="flex flex-wrap gap-1.5">{r.unusual && <Badge tone="warning">Unusually high</Badge>}{r.above && <Badge tone="brand">Requires review</Badge>}{r.filtered && <Badge>Length-filtered</Badge>}</div></td>
                        <td className="px-5 py-3 text-right"><Button size="sm" icon={GitCompare} onClick={() => setPair({ a: r.a, b: r.b, z: r.z })} aria-label={`Compare ${name(r.a)} and ${name(r.b)}`}>Compare</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
      <PairDrawer pair={pair} params={debounced} onClose={() => setPair(null)} />
    </div>
  );
}
