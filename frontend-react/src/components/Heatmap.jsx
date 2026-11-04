import { useApp } from "../lib/app-context";

/* Heat ramp endpoints per theme (r,g,b). Text colour is chosen from the cell's real luminance,
   so every number keeps >= 4.5:1 contrast on both themes. */
const RAMP = { light: { lo: [244, 246, 251], hi: [55, 48, 163] }, dark: { lo: [25, 34, 58], hi: [139, 132, 255] } };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
export const cellColors = (v, theme) => {
  const { lo, hi } = RAMP[theme] || RAMP.light, c = mix(lo, hi, Math.max(0, Math.min(1, v)));
  return { bg: `rgb(${c})`, fg: lum(c) > 0.179 ? "#000" : "#fff" };
};

/** Accessible similarity matrix: a real grid of buttons (keyboard + screen-reader friendly), not a canvas. */
export default function Heatmap({ data, onPick }) {
  const { theme } = useApp();
  const { submissions: subs, matrix, params } = data, n = subs.length;
  const short = (s) => s.label.replace(/ v1$/, "");
  return (
    <div className="overflow-x-auto pb-2">
      <div role="grid" aria-label="Pairwise similarity matrix" className="inline-grid gap-px" style={{ gridTemplateColumns: `88px repeat(${n}, minmax(40px, 52px))` }}>
        <div role="row" className="contents">
          <div role="columnheader"><span className="sr-only">Submission</span></div>
          {subs.map((s) => <div key={s.id} role="columnheader" className="h-20 text-xs font-semibold text-muted"><span className="block origin-bottom-left translate-x-5 translate-y-14 -rotate-45 whitespace-nowrap">{short(s)}</span></div>)}
        </div>
        {matrix.map((row, i) => (
          <div role="row" key={subs[i].id} className="contents">
            <div role="rowheader" className="flex items-center justify-end pr-2 text-xs font-semibold text-muted">{short(subs[i])}</div>
            {row.map((v, j) => {
              const { bg, fg } = cellColors(v, theme), hit = i !== j && v >= params.threshold;
              return (
                <button key={j} role="gridcell" disabled={i === j} onClick={() => onPick(subs[i].id, subs[j].id)}
                  aria-label={i === j ? `${short(subs[i])} (self)` : `${short(subs[i])} and ${short(subs[j])}: similarity ${v.toFixed(2)}${hit ? ", above threshold" : ""}`}
                  title={i === j ? undefined : `${short(subs[i])} ↔ ${short(subs[j])}: ${v.toFixed(3)}`}
                  className="relative aspect-square min-h-10 text-xs font-bold tabular-nums transition-transform duration-100 enabled:hover:z-10 enabled:hover:scale-110 enabled:active:scale-95 disabled:cursor-default"
                  style={{ background: bg, color: fg, outline: hit ? "2px solid var(--warning-solid)" : undefined, outlineOffset: -2 }}>
                  {n <= 14 ? v.toFixed(2).replace(/^0/, "") : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="inline-block size-3 rounded-sm" style={{ outline: "2px solid var(--warning-solid)", outlineOffset: -2 }} aria-hidden="true" />
        Outlined cells are at or above the threshold ({params.threshold}). Select a cell to compare the pair.
      </p>
    </div>
  );
}
