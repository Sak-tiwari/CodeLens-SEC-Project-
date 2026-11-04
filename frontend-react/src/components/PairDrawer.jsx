import { Drawer, Badge, ErrorBanner, SkeletonRows, StatusBadge, Card, CardHeader, cx } from "./ui";
import { api, analysisQuery } from "../lib/api";
import { useAsync } from "../lib/useAsync";

const LABELS = { raw: "Raw text (Levenshtein)", normalized: "Normalized text", cosine: "Token cosine", ngram: "Token n-gram Jaccard", length: "Length ratio", lcs: "LCS (tokens)" };

function Code({ src }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-xl bg-code-bg py-3 font-mono text-[13px] leading-6 text-code-ink" tabIndex={0} aria-label="Source code">
      {String(src).split("\n").map((l, i) => (
        <span key={i} className="block whitespace-pre pr-4"><span className="mr-3 inline-block w-10 select-none text-right text-code-ln" aria-hidden="true">{i + 1}</span>{l || " "}</span>
      ))}
    </pre>
  );
}

export default function PairDrawer({ pair, params, onClose }) {
  const open = !!pair;
  const q = pair ? `${analysisQuery(params)}${pair.z != null ? `&z=${pair.z}` : ""}` : "";
  const res = useAsync((signal) => (pair ? api(`/api/pairs/${pair.a}/${pair.b}?${q}`, { signal }) : null), [pair?.a, pair?.b, q]);
  const r = res.data;
  return (
    <Drawer open={open} onClose={onClose} title="Pair comparison">
      {res.error ? <ErrorBanner error={res.error} onRetry={res.reload} /> : res.loading || !r ? <SkeletonRows rows={6} /> : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {[r.a, r.b].map((s, i) => (
              <div key={i} className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{s.student} v{s.version}</h3><StatusBadge status={s.overall_status} /></div>
                <Code src={s.source_code} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Score breakdown" />
              <div className="space-y-3 p-5">
                {Object.keys(LABELS).map((k) => (
                  <div key={k} className="grid grid-cols-[150px_1fr_44px] items-center gap-3 text-sm">
                    <span className="text-ink-2">{LABELS[k]}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${LABELS[k]} ${r.scores[k].toFixed(2)}`}><div className="h-full rounded-full bg-brand" style={{ width: `${r.scores[k] * 100}%` }} /></div>
                    <b className="text-right tabular-nums">{r.scores[k].toFixed(2)}</b>
                  </div>
                ))}
                <div className="grid grid-cols-[150px_1fr_44px] items-center gap-3 border-t border-line pt-3 text-sm font-bold">
                  <span>Composite</span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Composite ${r.scores.composite.toFixed(2)}`}><div className="h-full rounded-full bg-brand" style={{ width: `${r.scores.composite * 100}%` }} /></div>
                  <b className="text-right tabular-nums">{r.scores.composite.toFixed(2)}</b>
                </div>
                {pair?.z != null && !Number.isNaN(pair.z) && <p className="text-sm text-muted">z-score among all pairs: <b className="text-ink">{pair.z.toFixed(2)}</b></p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Classification" hint="Final judgement always rests with a human reviewer." />
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-2">{r.classification.map((c) => <Badge key={c} tone={c === "Below threshold" ? "neutral" : c === "Requires Review" ? "brand" : "warning"}>{c}</Badge>)}</div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            </Card>
          </div>
        </div>
      )}
    </Drawer>
  );
}
