import { ArrowRight, FileCode2, Gauge, Inbox, ListChecks, Network, ShieldAlert, SlidersHorizontal, Users } from "lucide-react";
import { api, analysisQuery } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useAsync } from "../lib/useAsync";
import { STATUS, STATUS_ORDER } from "../lib/status";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, PageHeader, SkeletonRows, StatCard, StatusBadge, cx } from "../components/ui";

const QUICK = [
  { id: "workspace", title: "Run similarity analysis", text: "Heatmap, graph clusters and ranked pairs.", icon: Network },
  { id: "workspace", title: "Review flagged pairs", text: "Pairs above your threshold, strongest first.", icon: ShieldAlert },
  { id: "settings", title: "Tune thresholds & weights", text: "Defaults used by every analysis.", icon: SlidersHorizontal },
];

export default function Dashboard({ go }) {
  const { aid, assignment, settings } = useApp();
  const subs = useAsync((signal) => api(`/api/assignments/${aid}/submissions`, { signal }), [aid]);
  const sim = useAsync((signal) => api(`/api/assignments/${aid}/analysis?${analysisQuery({ ...settings, candidate: settings.candidate })}`, { signal }),
    [aid, settings.threshold, settings.candidate, settings.n]);

  const list = subs.data || [];
  const counts = list.reduce((m, s) => ((m[s.overall_status] = (m[s.overall_status] || 0) + 1), m), {});
  const avg = list.length ? list.reduce((t, s) => t + (s.score || 0), 0) / list.length : 0;
  const flagged = (sim.data?.pairs || []).filter((p) => p.above);
  const recent = [...list].sort((a, b) => b.submission_id - a.submission_id).slice(0, 6);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader kicker="Instructor overview" title={assignment?.title || "Dashboard"}
        text={assignment ? `${assignment.description} · ${assignment.tests} test cases` : undefined}
        actions={<Button variant="primary" icon={Network} onClick={() => go("workspace")}>Open workspace</Button>} />

      {subs.error && <ErrorBanner error={subs.error} onRetry={subs.reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Submissions" value={list.length} icon={Users} loading={subs.loading} hint="in this assignment" />
        <StatCard label="Passed all tests" value={counts.PASS || 0} icon={ListChecks} accent="success" loading={subs.loading} hint={list.length ? `${Math.round(((counts.PASS || 0) / list.length) * 100)}% of submissions` : undefined} />
        <StatCard label="Average score" value={`${avg.toFixed(0)}%`} icon={Gauge} accent="warning" loading={subs.loading} />
        <StatCard label="Pairs to review" value={flagged.length} icon={ShieldAlert} accent="info" loading={sim.loading}
          hint={`similarity ≥ ${settings.threshold}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent submissions" hint="Newest first" action={<Button size="sm" variant="ghost" onClick={() => go("workspace")}>Analyse<ArrowRight className="size-4" aria-hidden="true" /></Button>} />
          {subs.loading ? <SkeletonRows /> : recent.length === 0 ? (
            <EmptyState icon={Inbox} title="No submissions yet" text="Submissions appear here as students upload C programs."
              action={<Button variant="primary" onClick={() => go("workspace")}>Open workspace</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-muted">
                  {["Student", "Version", "Outcome", "Score", "Origin"].map((h, i) => <th key={h} scope="col" className={cx("px-5 py-3 font-bold", i === 3 && "text-right")}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {recent.map((s) => (
                    <tr key={s.submission_id} className="transition-colors hover:bg-surface-2">
                      <th scope="row" className="px-5 py-3 text-left font-semibold">{s.student}</th>
                      <td className="px-5 py-3 text-muted">v{s.version}</td>
                      <td className="px-5 py-3"><StatusBadge status={s.overall_status} /></td>
                      <td className="px-5 py-3 text-right tabular-nums">{(s.score ?? 0).toFixed(0)}%</td>
                      <td className="px-5 py-3"><Badge>{s.origin}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Outcome mix" />
            <div className="p-5">
              {subs.loading ? <SkeletonRows rows={2} /> : list.length === 0 ? <p className="text-sm text-muted">No data yet.</p> : (
                <>
                  <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img"
                    aria-label={STATUS_ORDER.filter((k) => counts[k]).map((k) => `${STATUS[k].label} ${counts[k]}`).join(", ")}>
                    {STATUS_ORDER.filter((k) => counts[k]).map((k) => <span key={k} className={STATUS[k].solid} style={{ flex: counts[k] }} />)}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {STATUS_ORDER.map((k) => { const Icon = STATUS[k].icon; return (
                      <li key={k} className="flex items-center justify-between">
                        <span className={cx("flex items-center gap-2", STATUS[k].text)}><Icon className="size-4" aria-hidden="true" />{STATUS[k].label}</span>
                        <span className="font-semibold tabular-nums">{counts[k] || 0}</span>
                      </li>); })}
                  </ul>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick actions" />
            <ul className="divide-y divide-line">
              {QUICK.map(({ id, title, text, icon: Icon }) => (
                <li key={title}>
                  <button onClick={() => go(id)} className="group flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2 active:bg-brand-soft">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted">{text}</span></span>
                    <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Top flagged pairs" hint="Structural similarity for human review. High similarity is not proof of plagiarism."
          action={<Button size="sm" onClick={() => go("workspace")}>See all</Button>} />
        {sim.error ? <div className="p-5"><ErrorBanner error={sim.error} onRetry={sim.reload} /></div>
          : sim.loading ? <SkeletonRows rows={3} />
          : flagged.length === 0 ? <EmptyState icon={ShieldAlert} title="No pairs above the threshold" text="Nothing needs review at this threshold. Lower it in the workspace to widen the net."
              action={<Button variant="primary" icon={FileCode2} onClick={() => go("workspace")}>Open workspace</Button>} />
          : <ul className="divide-y divide-line">
              {flagged.slice(0, 5).map((p) => {
                const name = (id) => sim.data.submissions.find((s) => s.id === id)?.label || `#${id}`;
                return (
                  <li key={`${p.a}-${p.b}`} className="flex flex-wrap items-center gap-4 px-5 py-3">
                    <span className="min-w-[200px] flex-1 font-semibold">{name(p.a)} <span className="text-muted">↔</span> {name(p.b)}</span>
                    <div className="flex w-48 items-center gap-3" role="img" aria-label={`Composite similarity ${p.composite.toFixed(2)}`}>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-brand" style={{ width: `${p.composite * 100}%` }} /></div>
                      <b className="w-10 text-right tabular-nums">{p.composite.toFixed(2)}</b>
                    </div>
                    <Badge tone="brand">Requires review</Badge>
                  </li>);
              })}
            </ul>}
      </Card>
    </div>
  );
}
