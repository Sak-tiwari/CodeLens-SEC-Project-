/* CodeLens pair viewer: the side-by-side review window.
   Opened from the heatmap, graph, ranked-pairs list, Statistics outliers (showPair)
   and the SSCD evaluation table (showSscdPair). Shows both programs, the score
   breakdown, the classification and the plain-language reasons. It never declares
   plagiarism: the final judgement is always a person's.
   Loaded before app.js; uses its shared helpers (api, openModal, code, esc, badge, bar, ...). */
"use strict";

function scoreRows(sc) {
  return ["raw", "normalized", "cosine", "ngram", "length", "lcs"].map((k) => `<div class="score-row"><span>${SIM_LABELS[k]}${k === "ngram" ? ` (n=${state.params.n})` : ""}</span>${bar(sc[k], k === "normalized" ? "t" : "")}<b>${f2(sc[k])}</b></div>`).join("")
    + `<div class="score-row total"><span>Composite score</span>${bar(sc.composite)}<b>${f2(sc.composite)}</b></div>`;
}
function reasonsHtml(r) { return `<div class="row">${r.classification.map((c) => `<span class="badge ${c === "Below threshold" ? "mute" : c === "Requires Review" ? "flag" : "warn"}">${esc(c)}</span>`).join("")}</div><ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`; }
async function showPair(a, b, z) {
  openModal(loading("Comparing"));
  const q = queryString() + (z != null && !isNaN(z) ? "&z=" + z : "");
  let r; try { r = await api(`/api/pairs/${a}/${b}?${q}`); } catch (e) { return closeModal(); }
  openModal(`<h2>Pair comparison</h2>
    <div class="split"><div><div class="row"><h3 style="margin:0">${esc(r.a.student)} v${r.a.version}</h3>${badge(r.a.overall_status)}</div>${code(r.a.source_code)}</div>
    <div><div class="row"><h3 style="margin:0">${esc(r.b.student)} v${r.b.version}</h3>${badge(r.b.overall_status)}</div>${code(r.b.source_code)}</div></div>
    <div class="split mt"><section class="card"><h3>Score breakdown</h3>${scoreRows(r.scores)}${z != null && !isNaN(z) ? `<p class="muted">z-score among all pairs: <b>${z.toFixed(2)}</b></p>` : ""}</section>
    <section class="card"><h3>Classification and explanation</h3>${reasonsHtml(r)}<p class="muted mt2">Final judgement always rests with a human reviewer.</p></section></div>`);
}

/* SSCD clone pairs: same layout, with file names and line ranges. */
async function showSscdPair(kind, idx) {
  openModal(loading("Comparing"));
  let r; try { r = await api(`/api/sscd/pair/${kind}/${idx}?threshold=${state.params.threshold}`); } catch (e) { return closeModal(); }
  const side = (s, t) => `<div><h3 style="margin:0">${t}</h3><div class="muted" style="font:12px var(--mono);margin:2px 0 8px;overflow-wrap:anywhere">${esc(s.file)}:${s.start}-${s.end}</div>${code(s.code)}</div>`;
  openModal(`<h2>${kind === "clone" ? "Known clone pair" : "Sampled non-clone pair"} #${idx} <small class="muted">${esc(r.granularity)}</small></h2>
    <div class="split">${side(r.a, "Fragment A")}${side(r.b, "Fragment B")}</div>
    <div class="split mt"><section class="card"><h3>Score breakdown</h3>${scoreRows(r.scores)}</section><section class="card"><h3>Classification and explanation</h3>${reasonsHtml(r)}<p class="muted mt2">${kind === "clone" ? "Listed as a clone in the SSCD dataset." : "A sampled comparison pair, not verified ground truth."} Final judgement rests with a human reviewer.</p></section></div>`);
}
