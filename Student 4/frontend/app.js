/* CodeLens dashboard - plain JavaScript, no external dependencies (works offline). */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x * 100).toFixed(0) + "%";
const f2 = (x) => Number(x).toFixed(2);
const STATUS = {
  PASS: ["Pass", "#17803f"], WRONG_ANSWER: ["Wrong answer", "#b36b00"], COMPILATION_ERROR: ["Compile error", "#c42b3c"],
  RUNTIME_ERROR: ["Runtime error", "#6b46c1"], TIMEOUT: ["Timeout", "#0a7f94"],
};
const PALETTE = ["#1f56d6", "#0a7f94", "#c2610c", "#c2255c", "#3f7d1f", "#6b46c1", "#8a6d00", "#475569", "#b42318", "#0b5f3e"];
const SIM_LABELS = { raw: "Raw text (Levenshtein)", normalized: "Normalized text", cosine: "Token cosine", ngram: "Token n-gram Jaccard", length: "Length ratio", lcs: "LCS (tokens)" };

const state = {
  role: "instructor", userId: null, users: [], assignments: [], aid: null, view: "overview", health: {},
  params: { threshold: 0.75, candidate: 0.5, n: 3, weights: { raw: 0.10, cosine: 0.25, ngram: 0.55, length: 0.10, lcs: 0 } },
  analysis: null, showAllPairs: false, lab: "transform", lastSubmit: null,
};
const VIEWS = {
  overview: { title: "Overview", all: true }, submissions: { title: "Submissions", all: true }, submit: { title: "Submit code", all: true },
  similarity: { title: "Similarity", instructor: true }, statistics: { title: "Statistics", instructor: true },
  sscd: { title: "SSCD evaluation", instructor: true }, scalability: { title: "Scalability", instructor: true }, lab: { title: "Demo lab", instructor: true },
};

/* ---------------------------------------------------------------- helpers */
function badge(status) { const s = STATUS[status]; return `<span class="badge ${esc(status)}">${s ? s[0] : esc(status || "-")}</span>`; }
function pills(execs) { return `<span class="pills" title="One square per test">${(execs || []).map((e) => `<i class="${esc(e.status)}" title="Test ${e.test_id}: ${esc(e.status)}"></i>`).join("")}</span>`; }
function bar(v, cls = "") { return `<div class="bar ${cls}" role="img" aria-label="${pct(v)}"><i style="width:${Math.max(0, Math.min(1, v)) * 100}%"></i></div>`; }
function code(src) { return `<pre class="code">${String(src).split("\n").map((l, i) => `<span class="ln" data-n="${i + 1}">${esc(l) || " "}</span>`).join("")}</pre>`; }
function heatColor(v) { // warm off-white -> blue
  const t = Math.max(0, Math.min(1, v));
  const a = [240, 234, 220], b = [31, 86, 214];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}
let toastTimer;
function toast(msg, err = false) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), err ? 6000 : 3000);
}
let renderSeq = 0, analysisSeq = 0;
async function api(path, opts = {}) {
  const tok = renderSeq;
  const headers = { "X-Role": state.role, "X-User-Id": state.userId ?? "" };
  if (opts.body) headers["Content-Type"] = "application/json";
  let res;
  try { res = await fetch(path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
  catch (e) { toast("Cannot reach the CodeLens server. Is it running?", true); throw e; }
  const data = await res.json().catch(() => ({}));
  if (tok !== renderSeq) { const e = new Error("stale"); e.stale = true; throw e; } // user navigated away meanwhile
  if (!res.ok) { toast(data.error || "Request failed", true); throw new Error(data.error || res.statusText); }
  return data;
}
function busy(btn, on) { btn.disabled = on; btn.dataset.l = btn.dataset.l || btn.textContent; btn.innerHTML = on ? `<span class="spinner"></span>Working...` : btn.dataset.l; }
const loading = (msg = "Loading") => `<div class="empty"><span class="spinner"></span>${esc(msg)}...</div>`;
const label = (id) => (state.analysis?.submissions.find((s) => s.id === id) || {}).label || "#" + id;

/* ---------------------------------------------------------------- shell */
function renderNav() {
  const items = Object.entries(VIEWS).filter(([, v]) => !v.instructor || state.role === "instructor");
  $("#nav").innerHTML = items.map(([k, v]) => `<a href="#${k}" class="${state.view === k ? "on" : ""}">${v.title}</a>`).join("");
}
function route() {
  let v = location.hash.slice(1) || "overview";
  if (!VIEWS[v] || (VIEWS[v].instructor && state.role !== "instructor")) v = "overview";
  if (location.hash.slice(1) !== v) history.replaceState(null, "", "#" + v);
  state.view = v; renderNav(); render();
}
async function render() {
  const seq = ++renderSeq, el = $("#view"); el.innerHTML = loading();
  try { await ({ overview, submissions, submit, similarity, statistics, sscd, scalability, lab }[state.view])(el); } catch (e) { if (!e.stale && seq === renderSeq) el.innerHTML = `<div class="empty">Something went wrong: ${esc(e.message)}</div>`; }
}
function openModal(html) { $("#modalBody").innerHTML = html; $("#modal").hidden = false; $("#modal .sheet").scrollTop = 0; $("#modalClose").focus(); }
function closeModal() { $("#modal").hidden = true; }
const curAssignment = () => state.assignments.find((a) => a.assignment_id === state.aid);

async function loadBase() {
  [state.users, state.assignments, state.health] = await Promise.all([api("/api/users"), api("/api/assignments"), api("/api/health")]);
  if (!state.aid || !curAssignment()) state.aid = state.assignments[0]?.assignment_id;
  $("#assignment").innerHTML = state.assignments.map((a) => `<option value="${a.assignment_id}" ${a.assignment_id === state.aid ? "selected" : ""}>${esc(a.title)}</option>`).join("");
  const students = state.users.filter((u) => u.role === "student");
  if (!state.userId || !students.find((u) => u.user_id === state.userId)) state.userId = students[0]?.user_id;
  $("#user").innerHTML = students.map((u) => `<option value="${u.user_id}" ${u.user_id === state.userId ? "selected" : ""}>${esc(u.name)}</option>`).join("");
  const h = $("#health");
  h.className = "chip " + (state.health.gcc ? "ok" : "bad");
  h.textContent = state.health.gcc ? "GCC ready" : "GCC not found";
  h.title = state.health.gcc || "Install GCC to compile and test submissions";
}

/* ---------------------------------------------------------------- overview */
async function overview(el) {
  const subs = await api(`/api/assignments/${state.aid}/submissions`);
  const a = curAssignment();
  const counts = {}; subs.forEach((s) => (counts[s.overall_status] = (counts[s.overall_status] || 0) + 1));
  const avg = subs.length ? subs.reduce((t, s) => t + (s.score || 0), 0) / subs.length : 0;
  const passed = counts.PASS || 0;
  const stackHtml = Object.keys(STATUS).filter((k) => counts[k]).map((k) => `<i style="flex:${counts[k]};background:${STATUS[k][1]}" title="${STATUS[k][0]}: ${counts[k]}"></i>`).join("");
  const legend = Object.keys(STATUS).map((k) => `<span style="--c:${STATUS[k][1]}">${STATUS[k][0]} ${counts[k] || 0}</span>`).join("");
  const guide = state.role === "instructor" ? `
    <section class="card mt"><h2>Guided demo</h2><p class="muted" style="margin-top:0">Follow these steps while presenting. Every step runs the real pipeline.</p>
    <ol class="steps">
      <li><div><b>See real submissions with test results</b><small>Each program was compiled with GCC and run on the test cases.</small></div><a class="btn" href="#submissions">Open</a></li>
      <li><div><b>Submit a program live</b><small>Pick a ready sample (correct, wrong, compile error, infinite loop, crash) and watch it graded.</small></div><a class="btn" href="#submit">Open</a></li>
      <li><div><b>Find similar submissions</b><small>Move the threshold slider and watch the heatmap, graph and components change.</small></div><a class="btn" href="#similarity">Open</a></li>
      <li><div><b>Plant a disguised copy</b><small>Rename variables or restructure a loop, submit it, and see whether the analysis still links it.</small></div><a class="btn" href="#lab" data-lab="plant">Open</a></li>
      <li><div><b>Which edits fool which measure?</b><small>Controlled transformation experiment and the normalization pipeline viewer.</small></div><a class="btn" href="#lab" data-lab="transform">Open</a></li>
      <li><div><b>Are the scores unusual?</b><small>Score distribution, z-scores and the pairs that stand out from the rest.</small></div><a class="btn" href="#statistics">Open</a></li>
      <li><div><b>Validate against known clones</b><small>80 real C clone pairs from the SSCD dataset: clone recall and false positives per threshold.</small></div><a class="btn" href="#sscd">Open</a></li>
      <li><div><b>How does it scale?</b><small>Measured runtime against N, compared with the N(N-1)/2 pair count.</small></div><a class="btn" href="#scalability">Open</a></li>
    </ol></section>` : `<section class="card mt"><h2>Student view</h2><p class="muted">Upload a C file in <b>Submit code</b> to see the compile result and test results. Other students' code and similarity flags are not visible to students.</p></section>`;
  el.innerHTML = `
    <h1>${esc(a?.title || "Assignment")}</h1><p class="muted" style="margin-top:0">${esc(a?.description || "")} &middot; ${a?.tests || 0} test cases</p>
    <div class="grid g4">
      <div class="card stat"><b>${subs.length}</b><span>${state.role === "student" ? "my submissions" : "submissions"}</span></div>
      <div class="card stat"><b>${passed}</b><span>passed all tests</span></div>
      <div class="card stat"><b>${avg.toFixed(0)}%</b><span>average score</span></div>
      <div class="card stat"><b>${Object.keys(counts).length}</b><span>different outcomes</span></div>
    </div>
    <section class="card mt"><h2>Outcome distribution</h2><div class="stack" role="img" aria-label="Outcome distribution">${stackHtml}</div><div class="legend">${legend}</div></section>
    ${guide}`;
  el.querySelectorAll("[data-lab]").forEach((a) => a.addEventListener("click", () => (state.lab = a.dataset.lab)));
}

/* ---------------------------------------------------------------- submissions */
async function submissions(el) {
  const subs = await api(`/api/assignments/${state.aid}/submissions`);
  el.innerHTML = `<div class="row between"><h1>Submissions</h1><button class="btn" id="refresh">Refresh</button></div>
    <p class="muted" style="margin-top:0">One square per test case. Click a row for the source code and test details.</p>
    <div class="card" style="padding:6px 8px;overflow:auto"><table><thead><tr><th>#</th><th>Student</th><th>Ver.</th><th>Compile</th><th>Tests</th><th>Outcome</th><th class="num">Score</th><th>Origin</th></tr></thead><tbody>
    ${subs.map((s) => `<tr class="click" data-id="${s.submission_id}"><td>${s.submission_id}</td><td><b>${esc(s.student)}</b></td><td>v${s.version}</td>
      <td>${s.compile_status === "OK" ? '<span class="badge PASS">OK</span>' : badge(s.compile_status)}</td><td>${pills(s.executions)}</td><td>${badge(s.overall_status)}</td>
      <td class="num">${(s.score ?? 0).toFixed(0)}%</td><td><span class="badge mute">${esc(s.origin)}</span></td></tr>`).join("") || `<tr><td colspan="8" class="empty">No submissions yet.</td></tr>`}
    </tbody></table></div>`;
  $("#refresh").onclick = render;
  el.querySelectorAll("tr.click").forEach((tr) => (tr.onclick = () => showSubmission(+tr.dataset.id)));
}
function execTable(execs) {
  return `<table><thead><tr><th>Test</th><th>Input</th><th>Expected</th><th>Actual</th><th>Status</th><th class="num">Time</th></tr></thead><tbody>
  ${execs.map((e) => `<tr><td>${e.test_id}</td><td><pre class="plain" style="max-height:70px">${esc(e.input_data)}</pre></td><td><pre class="plain" style="max-height:70px">${esc(e.expected_output)}</pre></td>
  <td><pre class="plain" style="max-height:70px">${esc(e.actual_output) || "<span class='muted'>(no output)</span>"}</pre></td><td>${badge(e.status)}</td><td class="num">${e.execution_time != null ? e.execution_time.toFixed(2) + " s" : "-"}</td></tr>`).join("")}</tbody></table>`;
}
async function showSubmission(id) {
  openModal(loading());
  let s; try { s = await api(`/api/submissions/${id}`); } catch (e) { return closeModal(); }
  openModal(`<h2>${esc(s.student)} &middot; v${s.version} <small class="muted">#${s.id ?? s.submission_id}</small></h2>
    <div class="row">${badge(s.overall_status)}<span class="muted">Score ${(s.score ?? 0).toFixed(0)}% &middot; ${esc(s.assignment)}</span></div>
    <div class="split mt"><div><h3>Source code</h3>${code(s.source_code)}</div>
    <div><h3>Compiler output</h3>${s.compile_status === "OK" ? `<pre class="plain">${esc(s.compile_log) || "Compiled successfully."}</pre>` : `<pre class="plain err">${esc(s.compile_log) || s.compile_status}</pre>`}
    <h3 class="mt">Test results</h3><div style="overflow:auto">${execTable(s.executions)}</div></div></div>`);
}

/* ---------------------------------------------------------------- submit */
async function submit(el) {
  const samples = await api("/api/samples");
  const students = state.users.filter((u) => u.role === "student");
  const first = Object.keys(samples)[0];
  el.innerHTML = `<h1>Submit a C program</h1><p class="muted" style="margin-top:0">The program is compiled with GCC and run against every test case under a ${2}-second timeout.</p>
  <div class="grid g2"><section class="card">
    <div class="row"><label class="sel">Ready sample <select id="sample">${Object.keys(samples).map((k) => `<option>${esc(k)}</option>`).join("")}</select></label>
    <label class="sel">Or upload .c file <input type="file" id="file" accept=".c,.txt,text/plain"></label></div>
    <div class="mt2"><textarea id="src" class="editor" spellcheck="false" aria-label="C source code"></textarea></div>
    <div class="row between mt2"><label class="sel">Student ${state.role === "student" ? `<b style="color:var(--ink)">${esc(students.find((u) => u.user_id === state.userId)?.name || "")}</b>` : `<select id="who">${students.map((u) => `<option value="${u.user_id}" ${u.name === "Demo Student" ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>`}</label>
    <button class="btn primary" id="go">Compile &amp; run tests</button></div>
  </section><section class="card" id="result"><h2>Result</h2><p class="muted">The compile output and per-test results appear here.</p></section></div>`;
  const src = $("#src"); src.value = samples[first];
  $("#sample").onchange = (e) => (src.value = samples[e.target.value]);
  $("#file").onchange = async (e) => { const f = e.target.files[0]; if (f) src.value = await f.text(); };
  src.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const p = src.selectionStart; src.setRangeText("    ", p, src.selectionEnd, "end"); } });
  if (state.lastSubmit) showResult(state.lastSubmit);
  $("#go").onclick = async (e) => {
    const btn = e.currentTarget; busy(btn, true);
    $("#result").innerHTML = `<h2>Result</h2>${loading("Compiling and running tests")}`;
    try {
      const uid = state.role === "student" ? state.userId : +$("#who").value;
      const r = await api(`/api/assignments/${state.aid}/submissions`, { method: "POST", body: { user_id: uid, source_code: src.value } });
      state.lastSubmit = r; showResult(r); toast(`Submission #${r.submission_id} graded: ${STATUS[r.overall_status]?.[0] || r.overall_status}`);
    } catch (err) { $("#result").innerHTML = `<h2>Result</h2><p class="muted">Submission failed.</p>`; }
    finally { busy(btn, false); }
  };
}
function showResult(r) {
  $("#result").innerHTML = `<h2>Result &middot; submission #${r.submission_id}</h2>
    <div class="row">${badge(r.overall_status)}<b>${(r.score ?? 0).toFixed(0)}%</b><span class="muted">${r.executions.filter((e) => e.status === "PASS").length} of ${r.executions.length} tests passed</span>${pills(r.executions)}</div>
    <h3 class="mt">Compiler</h3>${r.compile_status === "OK" ? `<pre class="plain">${esc(r.compile_log) || "Compiled successfully."}</pre>` : `<pre class="plain err">${esc(r.compile_log)}</pre>`}
    <h3 class="mt">Tests</h3><div style="overflow:auto">${execTable(r.executions)}</div>`;
}

/* ---------------------------------------------------------------- similarity */
let analysisTimer;
function queryString() {
  const p = state.params, q = new URLSearchParams({ threshold: p.threshold, candidate: p.candidate, n: p.n });
  Object.entries(p.weights).forEach(([k, v]) => q.set("w_" + k, v));
  return q.toString();
}
async function similarity(el) {
  const p = state.params;
  const sl = (id, text, min, max, step, val) => `<div class="slider"><label for="${id}">${text}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}_o">${val}</output></div>`;
  el.innerHTML = `<div class="row between"><h1>Similarity analysis</h1><button class="btn" id="rerun">Recompute</button></div>
    <div class="note">Results show <b>structural similarity for human review</b>. High similarity is not proof of plagiarism.</div>
    <div class="grid g2 mt"><section class="card"><h2>Graph and filter</h2>
      ${sl("threshold", "Edge threshold T", 0.5, 0.99, 0.01, p.threshold)}${sl("candidate", "Length filter T<sub>L</sub>", 0.3, 0.95, 0.05, p.candidate)}
      <div class="slider"><label for="ngn">n-gram size n</label><select id="ngn">${[2, 3, 4, 5].map((n) => `<option ${n === p.n ? "selected" : ""}>${n}</option>`).join("")}</select><span></span></div></section>
    <section class="card"><h2>Composite weights <small class="muted">(normalized to sum 1)</small></h2>
      ${["raw", "cosine", "ngram", "length", "lcs"].map((k) => sl("w_" + k, k === "ngram" ? "n-gram Jaccard" : k === "lcs" ? "LCS" : k[0].toUpperCase() + k.slice(1), 0, 1, 0.05, p.weights[k])).join("")}</section></div>
    <div id="sim" class="mt">${loading("Analyzing")}</div>`;
  const bind = (id, key, isW) => {
    const inp = $("#" + id), out = $("#" + id + "_o");
    inp.oninput = () => { const v = +inp.value; out.textContent = v; if (isW) p.weights[key] = v; else p[key] = v; schedule(); };
  };
  bind("threshold", "threshold"); bind("candidate", "candidate");
  Object.keys(p.weights).forEach((k) => bind("w_" + k, k, true));
  $("#ngn").onchange = (e) => { p.n = +e.target.value; schedule(); };
  $("#rerun").onclick = () => runAnalysis(true);
  const schedule = () => { clearTimeout(analysisTimer); analysisTimer = setTimeout(() => runAnalysis(), 180); };
  await runAnalysis();
}
async function runAnalysis(force) {
  const box = $("#sim"); if (!box) return;
  const t = performance.now(), my = ++analysisSeq;
  const a = await api(`/api/assignments/${state.aid}/analysis?${queryString()}`);
  if (!$("#sim") || my !== analysisSeq) return;  // a newer slider position superseded this response
  state.analysis = a;
  const gs = a.graph_stats, st = a.stats, ids = a.submissions.map((s) => s.id);
  box.innerHTML = `
    <div class="grid g4">
      ${[["vertices", gs.vertices], ["edges", gs.edges], ["components", gs.components], ["largest component", gs.largest_component], ["isolated nodes", gs.isolated], ["average degree", f2(gs.avg_degree)],
         ["pairs (N(N-1)/2)", st.total_pairs], ["filtered out", `${st.filtered_pairs} (${pct(st.reduction)})`], ["mean / std dev", `${f2(st.mean)} / ${f2(st.std_dev)}`], ["z &gt; 2 flags", st.unusual]]
        .map(([l, v]) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <div class="grid g2 mt">
      <section class="card"><h2>Similarity matrix</h2><p class="muted" style="margin-top:0">Darker = more similar. Click a cell to compare the pair.</p><div class="heat"><canvas id="heat"></canvas></div></section>
      <section class="card graph"><h2>Similarity graph <small class="muted">edge when S &ge; ${f2(a.params.threshold)}</small></h2><div id="graph"></div></section>
    </div>
    <section class="card mt"><h2>Connected components <small class="muted">found with hand-written BFS / DFS</small></h2><div class="grid g2" id="comps"></div></section>
    <section class="card mt"><div class="row between"><h2>Ranked pairs</h2><button class="btn sm" id="allPairs">${state.showAllPairs ? "Show top 12" : "Show all " + a.pairs.length}</button></div>
      <div style="overflow:auto"><table><thead><tr><th>Pair</th><th style="width:26%">Composite</th><th class="num">z</th><th>Flags</th><th></th></tr></thead><tbody id="pairs"></tbody></table></div></section>
    <p class="muted mt2">Analysis ${a.elapsed_ms} ms &middot; round trip ${(performance.now() - t).toFixed(0)} ms (pairwise scores are cached; sliders only re-run graph and statistics).</p>`;
  drawHeat(a, ids); drawGraph(a);
  $("#comps").innerHTML = a.components.map((c, i) => `<div class="comp"><b style="color:${PALETTE[i % PALETTE.length]}">Component ${i + 1}</b> <span class="muted">&middot; ${c.nodes.length} submission${c.nodes.length > 1 ? "s" : ""}</span><br>
    <small class="muted">BFS from ${esc(label(c.nodes[0]))}:</small> ${c.bfs.map((n) => `<code>${esc(label(n))}</code>`).join(" &rarr; ")}<br>
    <small class="muted">DFS:</small> ${c.dfs.map((n) => `<code>${esc(label(n))}</code>`).join(" &rarr; ")}</div>`).join("");
  const list = state.showAllPairs ? a.pairs : a.pairs.slice(0, 12);
  $("#pairs").innerHTML = list.map((p) => `<tr class="click" data-a="${p.a}" data-b="${p.b}" data-z="${p.z}"><td><b>${esc(label(p.a))}</b> &harr; <b>${esc(label(p.b))}</b></td>
    <td><div class="row" style="flex-wrap:nowrap">${bar(p.composite)}<b style="min-width:38px;text-align:right">${f2(p.composite)}</b></div></td><td class="num">${p.z.toFixed(1)}</td>
    <td>${p.unusual ? '<span class="badge warn">Unusually high</span> ' : ""}${p.above ? '<span class="badge flag">Requires review</span> ' : ""}${p.filtered ? '<span class="badge mute">Length-filtered</span>' : ""}</td><td><button class="btn sm">Compare</button></td></tr>`).join("");
  $("#pairs").querySelectorAll("tr").forEach((tr) => (tr.onclick = () => showPair(+tr.dataset.a, +tr.dataset.b, +tr.dataset.z)));
  $("#allPairs").onclick = () => { state.showAllPairs = !state.showAllPairs; runAnalysis(); };
}
function tip(e, html) { const t = $("#tip"); if (!html) { t.hidden = true; return; } t.innerHTML = html; t.hidden = false; t.style.left = e.clientX + 14 + "px"; t.style.top = e.clientY + 14 + "px"; }
function drawHeat(a, ids) {
  const n = ids.length, cv = $("#heat"), ctx = cv.getContext("2d"), lab = 96, cell = Math.max(26, Math.min(56, Math.floor(520 / Math.max(n, 1))));
  const dpr = window.devicePixelRatio || 1, size = lab + n * cell + 4;
  cv.width = size * dpr; cv.height = size * dpr; cv.style.width = size + "px"; cv.style.height = size + "px"; ctx.scale(dpr, dpr);
  ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textBaseline = "middle";
  a.submissions.forEach((s, i) => {
    ctx.fillStyle = "#586073"; ctx.textAlign = "right"; ctx.fillText(s.label.replace(/ v1$/, ""), lab - 6, lab + i * cell + cell / 2);
  });
  // column headers (rotated)
  a.submissions.forEach((s, i) => { ctx.save(); ctx.translate(lab + i * cell + cell / 2, lab - 8); ctx.rotate(-Math.PI / 4); ctx.fillStyle = "#586073"; ctx.textAlign = "left"; ctx.fillText(s.label.replace(/ v1$/, ""), 0, 0); ctx.restore(); });
  ctx.textAlign = "center";
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = a.matrix[i][j], x = lab + j * cell, y = lab + i * cell;
    ctx.fillStyle = heatColor(v); ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    if (i !== j && v >= a.params.threshold) { ctx.strokeStyle = "#14171f"; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4); }
    ctx.fillStyle = v > 0.5 ? "#ffffff" : "#2a3142"; if (cell >= 30) ctx.fillText(v.toFixed(2).replace(/^0/, ""), x + cell / 2, y + cell / 2);
  }
  const hit = (e) => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left - lab, y = e.clientY - r.top - lab; const j = Math.floor(x / cell), i = Math.floor(y / cell); return i >= 0 && j >= 0 && i < n && j < n ? [i, j] : null; };
  cv.onmousemove = (e) => { const h = hit(e); cv.style.cursor = h && h[0] !== h[1] ? "pointer" : "default"; tip(e, h ? `<b>${esc(a.submissions[h[0]].label)}</b> &harr; <b>${esc(a.submissions[h[1]].label)}</b><br>similarity ${a.matrix[h[0]][h[1]].toFixed(3)}` : null); };
  cv.onmouseleave = () => tip(null);
  cv.onclick = (e) => { const h = hit(e); if (h && h[0] !== h[1]) { const p = a.pairs.find((p) => (p.a === ids[h[0]] && p.b === ids[h[1]]) || (p.a === ids[h[1]] && p.b === ids[h[0]])); showPair(ids[h[0]], ids[h[1]], p ? p.z : null); } };
}
function drawGraph(a) {
  const n = a.submissions.length, W = 520, H = 440, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 60;
  const compOf = {}; a.components.forEach((c, i) => c.nodes.forEach((id) => (compOf[id] = i)));
  // order nodes by component so clusters sit together
  const order = a.components.flatMap((c) => c.nodes), pos = {};
  order.forEach((id, i) => { const ang = (2 * Math.PI * i) / n - Math.PI / 2; pos[id] = [cx + R * Math.cos(ang), cy + R * Math.sin(ang)]; });
  const lab = Object.fromEntries(a.submissions.map((s) => [s.id, s]));
  const edges = a.edges.map((e) => `<g class="edge" data-a="${e.a}" data-b="${e.b}"><line x1="${pos[e.a][0]}" y1="${pos[e.a][1]}" x2="${pos[e.b][0]}" y2="${pos[e.b][1]}" stroke="${PALETTE[compOf[e.a] % PALETTE.length]}" stroke-opacity=".55" stroke-width="${1 + (e.w - a.params.threshold) * 14}"/><line x1="${pos[e.a][0]}" y1="${pos[e.a][1]}" x2="${pos[e.b][0]}" y2="${pos[e.b][1]}" stroke="transparent" stroke-width="12"><title>${esc(lab[e.a].label)} - ${esc(lab[e.b].label)}: ${e.w.toFixed(2)}</title></line></g>`).join("");
  const nodes = order.map((id) => { const [x, y] = pos[id], c = PALETTE[compOf[id] % PALETTE.length], st = STATUS[lab[id].status]?.[1] || "#8a93a3";
    return `<g class="node" data-id="${id}" transform="translate(${x},${y})"><circle r="17" fill="${c}" fill-opacity=".9"/><circle r="21" fill="none" stroke="${st}" stroke-width="3"/><text y="38" text-anchor="middle" font-size="11" fill="#2a3142">${esc(lab[id].label.replace(/ v1$/, ""))}</text><title>${esc(lab[id].label)} - ${esc(STATUS[lab[id].status]?.[0] || "")}</title></g>`; }).join("");
  $("#graph").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Similarity graph">${edges}${nodes}</svg><div class="legend"><span style="--c:#1f56d6">Fill = component</span><span style="--c:#17803f">Ring = test outcome</span></div>`;
  $("#graph").querySelectorAll(".node").forEach((g) => (g.onclick = () => showSubmission(+g.dataset.id)));
  $("#graph").querySelectorAll(".edge").forEach((g) => (g.onclick = () => { const p = a.pairs.find((p) => p.a === +g.dataset.a && p.b === +g.dataset.b); showPair(+g.dataset.a, +g.dataset.b, p ? p.z : null); }));
}
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

/* ---------------------------------------------------------------- demo lab */
const LAB_TABS = { transform: "Controlled transformations", plant: "Plant a disguised copy", compare: "Live compare", pipeline: "Pipeline viewer" };
async function lab(el) {
  el.innerHTML = `<h1>Demo lab</h1><div class="tabs" role="tablist">${Object.entries(LAB_TABS).map(([k, v]) => `<button role="tab" data-t="${k}" class="${state.lab === k ? "on" : ""}">${v}</button>`).join("")}</div><div id="labBody"></div>
    <div class="row mt"><button class="btn sm" id="reset">Reset demo data</button><small class="muted">Deletes all submissions and re-imports the built-in demo assignments.</small></div>`;
  el.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { state.lab = b.dataset.t; lab(el); }));
  $("#reset").onclick = async (e) => { if (!confirm("Reset all demo data? This removes every submission.")) return; busy(e.currentTarget, true); try { await api("/api/demo/reset", { method: "POST" }); state.analysis = null; state.lastSubmit = null; await loadBase(); toast("Demo data reset"); route(); } finally { busy(e.currentTarget, false); } };
  const body = $("#labBody"); body.innerHTML = loading();
  const subs = await api(`/api/assignments/${state.aid}/submissions`);
  await ({ transform: labTransform, plant: labPlant, compare: labCompare, pipeline: labPipeline }[state.lab])(body, subs);
}
const subOptions = (subs, sel) => subs.map((s) => `<option value="${s.submission_id}" ${s.submission_id === sel ? "selected" : ""}>#${s.submission_id} ${esc(s.student)} v${s.version} (${esc(STATUS[s.overall_status]?.[0] || "")})</option>`).join("");
function cellStyle(v) { const c = heatColor(v); return `background:${c};color:${v > 0.5 ? "#ffffff" : "#2a3142"}`; }

async function labTransform(body, subs) {
  const q = (sel) => body.querySelector(sel);
  const ok = subs.filter((s) => s.overall_status === "PASS");
  const def = (ok.find((s) => s.student === "Alice") || ok[0] || subs[0])?.submission_id;
  body.innerHTML = `<p class="muted" style="margin-top:0">Take one correct program, apply one superficial edit at a time (A-F) and see how every similarity measure reacts. Each edited program is also compiled and re-tested to show it still behaves the same.</p>
    <div class="row"><label class="sel">Base program <select id="base">${subOptions(ok.length ? ok : subs, def)}</select></label><button class="btn primary" id="run">Run experiment</button></div><div id="out" class="mt"></div>`;
  const run = async () => {
    const btn = q("#run"); busy(btn, true); q("#out").innerHTML = loading("Transforming, compiling and testing");
    try {
      const rows = await api(`/api/demo/transformations/${q("#base").value}`);
      const cols = ["raw", "normalized", "cosine", "ngram", "length", "composite"];
      q("#out").innerHTML = `<div class="card" style="overflow:auto"><table class="cells"><thead><tr><th>Edit</th>${cols.map((c) => `<th class="num">${c === "composite" ? "Composite" : SIM_LABELS[c].replace(" (Levenshtein)", "")}</th>`).join("")}<th>Still passes tests?</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => r.applicable ? `<tr><td><b>${r.key}</b> &middot; ${esc(r.label)}</td>${cols.map((c) => `<td class="cell" style="${cellStyle(r.scores[c])}">${f2(r.scores[c])}</td>`).join("")}<td>${r.tests ? `${badge(r.tests.status)} ${r.tests.passed}/${r.tests.total}` : "-"}</td><td><button class="btn sm" data-i="${i}">View code</button></td></tr>`
        : `<tr><td><b>${r.key}</b> &middot; ${esc(r.label)}</td><td colspan="${cols.length + 2}" class="muted">Not applicable to this program (e.g. it has no for loop).</td></tr>`).join("")}</tbody></table></div>
      <p class="muted mt2">Reading the table: raw text collapses under formatting, comments or renaming, while the token-based measures stay high. That is why the progression Raw &rarr; Normalized &rarr; Tokens &rarr; N-grams is used.</p>`;
      q("#out").querySelectorAll("button[data-i]").forEach((b) => (b.onclick = () => openModal(`<h2>${esc(rows[+b.dataset.i].label)}</h2>${code(rows[+b.dataset.i].code)}`)));
    } finally { busy(btn, false); }
  };
  q("#run").onclick = run; run();
}

async function labPlant(body, subs) {
  const q = (sel) => body.querySelector(sel);
  const ok = subs.filter((s) => s.origin !== "demo-copy"), def = (ok.find((s) => s.student === "Alice") || ok[0])?.submission_id;
  body.innerHTML = `<p class="muted" style="margin-top:0">Simulate a disguised copy: pick a program and an edit, submit it as "Demo Student" and watch it get graded and linked to the original in the similarity graph.</p>
    <div class="card"><div class="row"><label class="sel">Copy of <select id="src">${subOptions(ok, def)}</select></label>
    <label class="sel">Disguise <select id="kind"><option value="rename">Variable renaming</option><option value="comments">Comment changes</option><option value="whitespace">Whitespace changes</option><option value="for_to_while">for &rarr; while</option><option value="expression">Equivalent expression</option></select></label>
    <button class="btn primary" id="go">Submit disguised copy</button></div><div id="out" class="mt"></div></div>`;
  q("#go").onclick = async (e) => {
    const btn = e.currentTarget; busy(btn, true); q("#out").innerHTML = loading("Submitting");
    try {
      const r = await api("/api/demo/plant", { method: "POST", body: { submission_id: +q("#src").value, kind: q("#kind").value, seed: Math.floor(Math.random() * 6) + 1 } });
      state.analysis = null;
      q("#out").innerHTML = `<div class="row">${badge(r.overall_status)}<b>Submission #${r.submission_id} added</b><span class="muted">${(r.score || 0).toFixed(0)}% &middot; ${esc(r.student)}</span></div>
        <div class="row mt2"><a class="btn primary" href="#similarity">See it in the similarity graph</a><button class="btn" id="vc">View the disguised code</button></div>`;
      q("#vc").onclick = () => openModal(`<h2>Disguised copy #${r.submission_id}</h2>${code(r.source_code)}`);
    } finally { busy(btn, false); }
  };
}

async function labCompare(body, subs) {
  const q = (sel) => body.querySelector(sel);
  const a = subs[0], b = subs[1];
  const [sa, sb] = await Promise.all([api(`/api/submissions/${a.submission_id}`), api(`/api/submissions/${b.submission_id}`)]);
  body.innerHTML = `<p class="muted" style="margin-top:0">Paste or edit any two C programs and compare them instantly. Try renaming variables on one side.</p>
    <div class="split"><textarea id="a" class="editor" spellcheck="false" aria-label="Program A" style="min-height:260px"></textarea><textarea id="b" class="editor" spellcheck="false" aria-label="Program B" style="min-height:260px"></textarea></div>
    <div class="row mt2"><button class="btn primary" id="go">Compare</button><small class="muted">Updates automatically 0.5 s after you stop typing.</small></div><div id="out" class="mt"></div>`;
  q("#a").value = sa.source_code; q("#b").value = sb.source_code;
  let t; const run = async () => {
    try {
      const r = await api("/api/demo/compare", { method: "POST", body: { a: q("#a").value, b: q("#b").value, threshold: state.params.threshold, n: state.params.n, weights: state.params.weights } });
      q("#out").innerHTML = `<div class="split"><section class="card"><h3>Score breakdown</h3>${scoreRows(r.scores)}</section><section class="card"><h3>Explanation</h3>${reasonsHtml(r)}</section></div>`;
    } catch (e) { /* toast already shown */ }
  };
  ["a", "b"].forEach((id) => q("#" + id).addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 500); }));
  q("#go").onclick = run; run();
}

async function labPipeline(body, subs) {
  const q = (sel) => body.querySelector(sel);
  const def = subs[0]?.submission_id;
  body.innerHTML = `<p class="muted" style="margin-top:0">The same program as it moves through each normalization level, ending with the token sequence the similarity measures use.</p>
    <div class="row"><label class="sel">Program <select id="p">${subOptions(subs, def)}</select></label></div><div id="out" class="mt"></div>`;
  const run = async () => {
    q("#out").innerHTML = loading();
    const r = await api(`/api/demo/pipeline/${q("#p").value}`);
    const stage = (n, t, html) => `<section class="card"><h3><span class="badge flag">${n}</span> ${t}</h3>${html}</section>`;
    q("#out").innerHTML = `<div class="grid g2">${stage("0", "Raw source (baseline)", `<pre class="plain">${esc(r.raw)}</pre>`)}${stage("1", "Whitespace normalized", `<pre class="plain">${esc(r.whitespace)}</pre>`)}
      ${stage("2", "Comments removed", `<pre class="plain">${esc(r.no_comments)}</pre>`)}${stage("canonical", "Canonical text (used for normalized similarity)", `<pre class="plain">${esc(r.canonical)}</pre>`)}
      ${stage("3", "Literals normalized (tokens)", `<div class="toks">${r.tokens_literals.map((t) => `<code>${esc(t)}</code>`).join("")}</div>`)}${stage("4", "Identifiers normalized (final tokens)", `<div class="toks">${r.tokens.map((t) => `<code>${esc(t)}</code>`).join("")}</div><p class="muted mt2">${r.tokens.length} tokens</p>`)}</div>`;
  };
  q("#p").onchange = run; run();
}

/* ---------------------------------------------------------------- shared chart helpers */
const INK = "#14171f", MUTED = "#586073", GRID = "#ddd5c3", BLUE = "#1f56d6", RED = "#c42b3c";
function chartSvg({ W = 520, H = 290, L = 48, B = 38, T = 14, R = 14, series, xmin = 0, xmax = 1, ymin = 0, ymax = 1, xlab = "", ylab = "", vline = null, yfmt = (v) => v.toFixed(1), xfmt = (v) => v.toFixed(1) }) {
  const X = (v) => L + ((v - xmin) / (xmax - xmin || 1)) * (W - L - R), Y = (v) => H - B - ((v - ymin) / (ymax - ymin || 1)) * (H - B - T);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ylab)} versus ${esc(xlab)}" style="width:100%;height:auto">`;
  ticks.forEach((t) => {
    const y = ymin + (ymax - ymin) * t, x = xmin + (xmax - xmin) * t;
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" stroke="${GRID}"/><text x="${L - 7}" y="${Y(y) + 4}" text-anchor="end" font-size="11" fill="${MUTED}">${yfmt(y)}</text>`;
    s += `<text x="${X(x)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="${MUTED}">${xfmt(x)}</text>`;
  });
  s += `<text x="${(L + W - R) / 2}" y="${H - 5}" text-anchor="middle" font-size="12" fill="${INK}">${esc(xlab)}</text><text transform="translate(13 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${INK}">${esc(ylab)}</text>`;
  if (vline != null) s += `<line x1="${X(vline)}" x2="${X(vline)}" y1="${T}" y2="${H - B}" stroke="${INK}" stroke-dasharray="4 3"/><text x="${X(vline) + 5}" y="${T + 11}" font-size="11" fill="${INK}">T = ${vline.toFixed(2)}</text>`;
  series.forEach((se) => { s += `<polyline fill="none" stroke="${se.color}" stroke-width="2.2" ${se.dash ? 'stroke-dasharray="5 4"' : ""} points="${se.pts.map((p) => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1)).join(" ")}"/>`; });
  return s + "</svg>";
}
function histSvg(vals, lo, hi, bins, { marker = null, color = BLUE, xlab = "", xfmt = (v) => v.toFixed(1) } = {}) {
  const W = 520, H = 250, L = 40, B = 36, T = 14, R = 12, counts = new Array(bins).fill(0), w = (hi - lo) / bins;
  vals.forEach((v) => { counts[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / w)))]++; });
  const my = Math.max(...counts, 1), X = (v) => L + ((v - lo) / (hi - lo)) * (W - L - R), Y = (c) => H - B - (c / my) * (H - B - T);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogram of ${esc(xlab)}" style="width:100%;height:auto">`;
  [0, 0.5, 1].forEach((t) => { const c = Math.round(my * t); s += `<line x1="${L}" x2="${W - R}" y1="${Y(c)}" y2="${Y(c)}" stroke="${GRID}"/><text x="${L - 6}" y="${Y(c) + 4}" text-anchor="end" font-size="11" fill="${MUTED}">${c}</text>`; });
  counts.forEach((c, i) => { if (c) s += `<rect x="${X(lo + i * w) + 1}" y="${Y(c)}" width="${Math.max(1, X(lo + w) - X(lo) - 2)}" height="${H - B - Y(c)}" fill="${color}"><title>${xfmt(lo + i * w)} to ${xfmt(lo + (i + 1) * w)}: ${c} pair${c > 1 ? "s" : ""}</title></rect>`; });
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => { const v = lo + (hi - lo) * t; s += `<text x="${X(v)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="${MUTED}">${xfmt(v)}</text>`; });
  s += `<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="${INK}">${esc(xlab)}</text>`;
  if (marker != null && marker >= lo && marker <= hi) s += `<line x1="${X(marker)}" x2="${X(marker)}" y1="${T}" y2="${H - B}" stroke="${RED}" stroke-width="2" stroke-dasharray="4 3"/><text x="${X(marker) + 5}" y="${T + 11}" font-size="11" fill="${RED}">${+marker.toFixed(2)}</text>`;
  return s + "</svg>";
}
const quantile = (arr, q) => { const s = [...arr].sort((a, b) => a - b); if (!s.length) return 0; const p = (s.length - 1) * q, lo = Math.floor(p); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo); };

/* ---------------------------------------------------------------- statistics */
async function statistics(el) {
  const a = await api(`/api/assignments/${state.aid}/analysis?${queryString()}`);
  state.analysis = a;
  const P = a.pairs, comp = P.map((p) => p.composite), zs = P.map((p) => p.z), m = a.stats.mean, sd = a.stats.std_dev;
  const flagged = P.filter((p) => p.z > 2), top = [...P].sort((x, y) => y.z - x.z).slice(0, 10);
  const meas = ["raw", "cosine", "ngram", "length", "lcs"].map((k) => { const v = P.map((p) => p.scores[k]), mu = v.reduce((s, x) => s + x, 0) / (v.length || 1); return { k, mu, sd: Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / (v.length || 1)), max: Math.max(0, ...v) }; });
  el.innerHTML = `<h1>Statistical analysis</h1><p class="muted" style="margin-top:0">How unusual is each pair compared with every other pair in <b>${esc(curAssignment()?.title || "")}</b>? z = (S &minus; &mu;) / &sigma; over all ${P.length} pairs.</p>
    <div class="grid g4">${[["pairs", P.length], ["mean", f2(m)], ["std deviation", f2(sd)], ["median", f2(quantile(comp, 0.5))], ["upper quartile", f2(quantile(comp, 0.75))], ["highest score", f2(Math.max(0, ...comp))], ["pairs above z = 2", flagged.length], [`S &ge; ${f2(a.params.threshold)}`, P.filter((p) => p.above).length]]
      .map(([l, v]) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <div class="grid g2 mt"><section class="card"><h2>Composite score distribution</h2>${histSvg(comp, 0, 1, 20, { marker: a.params.threshold, xlab: "composite similarity S" })}<p class="muted mt2" style="margin-bottom:0">Dashed line = graph threshold T.</p></section>
    <section class="card"><h2>z-score distribution</h2>${histSvg(zs, -3, 3, 24, { marker: 2, color: "#475569", xlab: "z-score" })}<p class="muted mt2" style="margin-bottom:0">Dashed line = z = 2. Pairs right of it are marked <i>Unusually High Similarity</i> for review, never plagiarism.</p></section></div>
    <div class="grid g2 mt"><section class="card"><h2>Pairs furthest above the average</h2><table><thead><tr><th>Pair</th><th class="num">S</th><th class="num">z</th><th></th></tr></thead><tbody>
      ${top.map((p) => `<tr class="click" data-a="${p.a}" data-b="${p.b}" data-z="${p.z}"><td><b>${esc(label(p.a))}</b> &harr; <b>${esc(label(p.b))}</b></td><td class="num">${f2(p.composite)}</td><td class="num">${p.z.toFixed(2)}</td><td>${p.unusual ? '<span class="badge warn">Unusually high</span>' : '<span class="badge mute">Within range</span>'}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">No pairs.</td></tr>`}</tbody></table></section>
    <section class="card"><h2>Component measures across all pairs</h2><table><thead><tr><th>Measure</th><th class="num">Mean</th><th class="num">Std dev</th><th class="num">Max</th></tr></thead><tbody>
      ${meas.map((r) => `<tr><td>${SIM_LABELS[r.k]}</td><td class="num">${f2(r.mu)}</td><td class="num">${f2(r.sd)}</td><td class="num">${f2(r.max)}</td></tr>`).join("")}</tbody></table>
      <p class="muted mt2" style="margin-bottom:0">Length-filtered pairs count as 0 for the filtered measures, as in the matrix.</p></section></div>
    <div class="note mt">z-scores are relative: with few submissions, or when most of the class solved the task the same way, a high z can be rare or common. Always read the code side by side before drawing any conclusion.</div>`;
  el.querySelectorAll("tr.click").forEach((tr) => (tr.onclick = () => showPair(+tr.dataset.a, +tr.dataset.b, +tr.dataset.z)));
}

/* ---------------------------------------------------------------- SSCD evaluation */
const SSCD_COL = { raw: "#8a6d00", normalized: "#c2610c", cosine: "#6b46c1", ngram: "#1f56d6", length: "#475569", lcs: "#0a7f94", composite: "#14171f" };
let sscdState = { t: 0.70, measure: "composite", kind: "all", all: false };
function sscdAt(res, m, t) {
  const pos = res.pairs.filter((r) => r.kind === "clone").map((r) => r.scores[m]), neg = res.pairs.filter((r) => r.kind === "non-clone").map((r) => r.scores[m]);
  const tp = pos.filter((x) => x >= t).length, fp = neg.filter((x) => x >= t).length, rec = tp / pos.length, pre = tp + fp ? tp / (tp + fp) : 0;
  return { tp, fp, recall: rec, fpr: fp / neg.length, precision: pre, f1: pre + rec ? (2 * pre * rec) / (pre + rec) : 0, np: pos.length, nn: neg.length };
}
async function sscd(el) {
  const res = await api("/api/sscd/evaluation"), S = sscdState, meta = res.meta;
  const best = Object.entries(res.summary).sort((x, y) => y[1].auc - x[1].auc)[0];
  el.innerHTML = `<div class="row between"><h1>SSCD clone evaluation</h1><small class="muted">Experiment 5 &middot; ${meta.positives} known clones &middot; ${meta.negatives} sampled non-clones &middot; computed in ${meta.elapsed_ms} ms</small></div>
    <div class="note">Positives are the ${meta.positives} known C clone pairs of the SSCD industrial dataset (function-level except 3). Negatives are <b>sampled comparison pairs</b> (two fragments from different clone groups, seed ${meta.seed}), not verified ground truth. They are mostly easy, so AUC saturates; compare measures by their behaviour at a fixed threshold.</div>
    <div class="grid g2 mt"><section class="card"><h2>Threshold</h2><div class="slider"><label for="sT">Threshold T</label><input type="range" id="sT" min="0.3" max="0.99" step="0.01" value="${S.t}"><output id="sT_o">${S.t.toFixed(2)}</output></div>
      <p class="muted" style="margin-bottom:0">Clone recall(T) = known clone pairs with S &ge; T divided by ${meta.positives}. A flagged non-clone is a false positive.</p></section>
      <section class="card"><h2>Best separating measure</h2><div class="stat"><b>${esc(SIM_LABELS[best[0]] || "Composite score")}</b><span>highest AUC ${best[1].auc.toFixed(3)}</span></div></section></div>
    <section class="card mt" style="overflow:auto"><h2>Every measure at this threshold</h2><table id="sscdTable"></table></section>
    <div class="grid g2 mt"><section class="card"><h2>Clone recall vs threshold</h2><div id="chartRecall"></div><div class="legend" id="legendR"></div></section>
      <section class="card"><h2>Non-clones flagged vs threshold</h2><div id="chartFpr"></div><div class="legend" id="legendF"></div></section></div>
    <section class="card mt"><div class="row between"><h2>Score distribution</h2><label class="sel">Measure <select id="sM">${res.measures.map((m) => `<option value="${m}" ${m === S.measure ? "selected" : ""}>${esc(SIM_LABELS[m] || "Composite")}</option>`).join("")}</select></label></div><div id="strip"></div>
      <div class="legend"><span style="--c:${BLUE}">Known clone pair</span><span style="--c:#8a93a3">Sampled non-clone pair</span></div></section>
    <div class="grid g2 mt"><section class="card" style="overflow:auto"><h2>Best n-gram size (Experiment 4, real clones)</h2><table><thead><tr><th class="num">n</th><th class="num">AUC</th><th class="num">Mean clone</th><th class="num">Mean non-clone</th></tr></thead><tbody>
      ${res.ngram_sizes.map((r) => `<tr><td class="num">${r.n}</td><td class="num">${r.auc.toFixed(3)}</td><td class="num">${f2(r.mean_pos)}</td><td class="num">${f2(r.mean_neg)}</td></tr>`).join("")}</tbody></table></section>
      <section class="card" style="overflow:auto"><h2>Candidate filter on these fragments (Experiment 9)</h2><table><thead><tr><th class="num">T<sub>L</sub></th><th class="num">Pairs kept</th><th class="num">Work saved</th><th class="num">Clones kept</th></tr></thead><tbody>
      ${res.filter.map((r) => `<tr><td class="num">${r.t_l}</td><td class="num">${r.candidates} / ${r.all_pairs}</td><td class="num">${pct(r.reduction)}</td><td class="num">${r.clones_retained} / ${r.clones_total}</td></tr>`).join("")}</tbody></table>
      <p class="muted mt2" style="margin-bottom:0">A filter that saves a lot but drops known clones is useless: T<sub>L</sub> &ge; 0.8 loses a third of them here.</p></section></div>
    <section class="card mt"><div class="row between"><h2>Evaluated pairs</h2><div class="row"><label class="sel">Show <select id="sK"><option value="all">all</option><option value="clone">clones only</option><option value="non-clone">non-clones only</option></select></label><button class="btn sm" id="sAll"></button></div></div>
      <div style="overflow:auto"><table><thead><tr><th>#</th><th>Kind</th><th>Fragment A</th><th>Fragment B</th><th class="num">Raw</th><th class="num">N-gram</th><th class="num">Composite</th><th></th></tr></thead><tbody id="sPairs"></tbody></table></div></section>`;
  const paint = () => {
    const t = S.t, rows = res.measures.map((m) => [m, sscdAt(res, m, t)]);
    $("#sscdTable").innerHTML = `<thead><tr><th>Measure</th><th class="num">AUC</th><th class="num">Clones detected</th><th class="num">Clone recall</th><th class="num">Non-clones flagged</th><th class="num">Precision</th><th class="num">F1</th></tr></thead><tbody>
      ${rows.map(([m, r]) => `<tr><td><b>${esc(SIM_LABELS[m] || "Composite score")}</b></td><td class="num">${res.summary[m].auc.toFixed(3)}</td><td class="num">${r.tp} / ${r.np}</td><td class="num">${pct(r.recall)}</td><td class="num">${r.fp} / ${r.nn}</td><td class="num">${pct(r.precision)}</td><td class="num">${r.f1.toFixed(2)}</td></tr>`).join("")}</tbody>`;
    const ts = Array.from({ length: 36 }, (_, i) => 0.3 + i * 0.02), ser = (key) => res.measures.map((m) => ({ name: m, color: SSCD_COL[m], pts: ts.map((x) => [x, sscdAt(res, m, x)[key]]) }));
    $("#chartRecall").innerHTML = chartSvg({ series: ser("recall"), xmin: 0.3, xmax: 1, xlab: "threshold T", ylab: "clone recall", vline: t });
    $("#chartFpr").innerHTML = chartSvg({ series: ser("fpr"), xmin: 0.3, xmax: 1, xlab: "threshold T", ylab: "non-clones flagged", vline: t });
    const lg = res.measures.map((m) => `<span style="--c:${SSCD_COL[m]}">${esc(m)}</span>`).join(""); $("#legendR").innerHTML = lg; $("#legendF").innerHTML = lg;
    strip();
  };
  const strip = () => {
    const m = S.measure, W = 1040, H = 150, L = 20, R = 20, X = (v) => L + v * (W - L - R), dots = [];
    res.pairs.forEach((r, i) => { const clone = r.kind === "clone", jit = ((i * 37) % 11) / 11; dots.push(`<circle cx="${X(r.scores[m]).toFixed(1)}" cy="${clone ? 34 + jit * 30 : 88 + jit * 30}" r="4.2" fill="${clone ? BLUE : "#8a93a3"}" fill-opacity=".75"><title>${r.kind} #${r.index}: ${f2(r.scores[m])}</title></circle>`); });
    $("#strip").innerHTML = `<svg viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Score distribution" style="width:100%;height:auto">${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${X(v)}" x2="${X(v)}" y1="14" y2="${H - 4}" stroke="${GRID}"/><text x="${X(v)}" y="${H + 14}" text-anchor="middle" font-size="11" fill="${MUTED}">${v.toFixed(2)}</text>`).join("")}
      <text x="${L}" y="12" font-size="11" fill="${BLUE}">known clones</text><text x="${L}" y="78" font-size="11" fill="${MUTED}">sampled non-clones</text>${dots.join("")}<line x1="${X(S.t)}" x2="${X(S.t)}" y1="14" y2="${H - 4}" stroke="${INK}" stroke-width="2" stroke-dasharray="4 3"/></svg>`;
  };
  const list = () => {
    let rs = res.pairs.filter((r) => S.kind === "all" || r.kind === S.kind).sort((x, y) => y.scores.composite - x.scores.composite);
    const n = rs.length; if (!S.all) rs = rs.slice(0, 15);
    $("#sPairs").innerHTML = rs.map((r, i) => `<tr class="click" data-k="${r.kind}" data-i="${r.index}"><td>${i + 1}</td><td><span class="badge ${r.kind === "clone" ? "flag" : "mute"}">${r.kind}</span></td>
      <td><code>${esc(r.a.file.split("/").pop())}:${r.a.start}-${r.a.end}</code></td><td><code>${esc(r.b.file.split("/").pop())}:${r.b.start}-${r.b.end}</code></td><td class="num">${f2(r.scores.raw)}</td><td class="num">${f2(r.scores.ngram)}</td><td class="num"><b>${f2(r.scores.composite)}</b></td><td><button class="btn sm">Compare</button></td></tr>`).join("");
    $("#sAll").textContent = S.all ? "Show top 15" : `Show all ${n}`;
    $("#sPairs").querySelectorAll("tr").forEach((tr) => (tr.onclick = () => showSscdPair(tr.dataset.k, +tr.dataset.i)));
  };
  $("#sT").oninput = (e) => { S.t = +e.target.value; $("#sT_o").textContent = S.t.toFixed(2); paint(); };
  $("#sM").onchange = (e) => { S.measure = e.target.value; strip(); };
  $("#sK").value = S.kind; $("#sK").onchange = (e) => { S.kind = e.target.value; list(); };
  $("#sAll").onclick = () => { S.all = !S.all; list(); };
  paint(); list();
}
async function showSscdPair(kind, idx) {
  openModal(loading("Comparing"));
  let r; try { r = await api(`/api/sscd/pair/${kind}/${idx}?threshold=${state.params.threshold}`); } catch (e) { return closeModal(); }
  const side = (s, t) => `<div><h3 style="margin:0">${t}</h3><div class="muted" style="font:12px var(--mono);margin:2px 0 8px;overflow-wrap:anywhere">${esc(s.file)}:${s.start}-${s.end}</div>${code(s.code)}</div>`;
  openModal(`<h2>${kind === "clone" ? "Known clone pair" : "Sampled non-clone pair"} #${idx} <small class="muted">${esc(r.granularity)}</small></h2>
    <div class="split">${side(r.a, "Fragment A")}${side(r.b, "Fragment B")}</div>
    <div class="split mt"><section class="card"><h3>Score breakdown</h3>${scoreRows(r.scores)}</section><section class="card"><h3>Classification and explanation</h3>${reasonsHtml(r)}<p class="muted mt2">${kind === "clone" ? "Listed as a clone in the SSCD dataset." : "A sampled comparison pair, not verified ground truth."} Final judgement rests with a human reviewer.</p></section></div>`);
}

/* ---------------------------------------------------------------- scalability */
function slope(rows, key) { const p = rows.filter((r) => r.n > 1 && r[key] > 0).map((r) => [Math.log(r.n), Math.log(r[key])]); if (p.length < 2) return NaN; const mx = p.reduce((s, q) => s + q[0], 0) / p.length, my = p.reduce((s, q) => s + q[1], 0) / p.length; return p.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0) / p.reduce((s, q) => s + (q[0] - mx) ** 2, 0); }
async function scalability(el) {
  el.innerHTML = `<h1>Scalability</h1><p class="muted" style="margin-top:0">Measured runtime of the token-level pipeline (tokenize, cosine, n-gram, length, graph) for growing N, against the theoretical pair count N(N&minus;1)/2. Inputs are edited copies of the demo programs, used for timing only; raw Levenshtein is excluded because it is far slower.</p>
    <div class="row"><label class="sel">Sizes N <input type="text" id="sizes" value="50,100,200,400,600" style="width:220px"></label><button class="btn primary" id="go">Measure</button></div><div id="out" class="mt"></div>
    <section class="card mt"><h2>Candidate filter reduction <small>on the 160 real SSCD fragments</small></h2><div id="filt">${loading()}</div></section>`;
  const run = async () => {
    const btn = $("#go"); busy(btn, true); $("#out").innerHTML = loading("Measuring");
    try {
      const rows = await api(`/api/demo/scalability?sizes=${encodeURIComponent($("#sizes").value)}`);
      const es = slope(rows, "similarity_ms"), et = slope(rows, "total_ms"), big = rows[rows.length - 1];
      $("#out").innerHTML = `<div class="grid g4">${[["largest N", big.n], ["pairs compared", big.pairs.toLocaleString()], ["total time", big.total_ms + " ms"], ["similarity growth exponent", isNaN(es) ? "-" : es.toFixed(2)], ["total growth exponent", isNaN(et) ? "-" : et.toFixed(2)], ["theory (pairs ~ N&sup2;)", "2.00"]].map(([l, v]) => `<div class="card stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
        <div class="grid g2 mt"><section class="card"><h2>Total time vs number of pairs</h2>${lineChart(rows)}</section>
        <section class="card" style="overflow:auto"><h2>Measured stages</h2><table><thead><tr><th class="num">N</th><th class="num">Pairs</th><th class="num">Theory</th><th class="num">Tokenize</th><th class="num">Similarity</th><th class="num">Graph</th><th class="num">Total</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="num">${r.n}</td><td class="num">${r.pairs}</td><td class="num">${r.theory_pairs}</td><td class="num">${r.tokenize_ms} ms</td><td class="num">${r.similarity_ms} ms</td><td class="num">${r.graph_ms} ms</td><td class="num"><b>${r.total_ms} ms</b></td></tr>`).join("")}</tbody></table>
        <p class="muted mt2" style="margin-bottom:0">Exponent = slope of ln(time) against ln(N). Pair comparison grows quadratically (exponent near 2); tokenizing grows only linearly, so it matters less as N grows.</p></section></div>`;
    } finally { busy(btn, false); }
  };
  $("#go").onclick = run;
  const filt = api("/api/sscd/evaluation").then((res) => { $("#filt").innerHTML = `<table><thead><tr><th class="num">T<sub>L</sub></th><th class="num">Pairs kept</th><th style="width:30%">Work saved</th><th style="width:30%">Known clones kept</th></tr></thead><tbody>
      ${res.filter.map((r) => `<tr><td class="num">${r.t_l}</td><td class="num">${r.candidates} / ${r.all_pairs}</td><td><div class="row" style="flex-wrap:nowrap">${bar(r.reduction)}<b style="min-width:42px;text-align:right">${pct(r.reduction)}</b></div></td><td><div class="row" style="flex-wrap:nowrap">${bar(r.retained_pct, "t")}<b style="min-width:42px;text-align:right">${r.clones_retained}/${r.clones_total}</b></div></td></tr>`).join("")}</tbody></table>
      <p class="muted mt2" style="margin-bottom:0">Reduction = 1 &minus; P<sub>c</sub>/P<sub>all</sub> over every pair of fragments. A filter must also keep the known clones: T<sub>L</sub> = 0.7 keeps 78 of 80, T<sub>L</sub> = 0.8 only 53.</p>`; }).catch(() => ($("#filt").innerHTML = '<p class="muted">Could not load.</p>'));
  await Promise.all([run(), filt]);
}
function lineChart(rows) {
  const W = 520, H = 300, L = 58, B = 40, T = 26, R = 40, mx = Math.max(...rows.map((r) => r.pairs), 1), my = Math.max(...rows.map((r) => r.total_ms), 1);
  const X = (v) => L + (v / mx) * (W - L - R), Y = (v) => H - B - (v / my) * (H - B - T);
  const pts = rows.map((r) => [X(r.pairs), Y(r.total_ms)]);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Runtime versus pair count" style="width:100%;height:auto">
    ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${Y(my * t)}" y2="${Y(my * t)}" stroke="#ddd5c3"/><text x="${L - 8}" y="${Y(my * t) + 4}" text-anchor="end" font-size="11" fill="#586073">${(my * t).toFixed(my < 10 ? 1 : 0)}</text>`).join("")}
    ${ticks.map((t) => `<text x="${X(mx * t)}" y="${H - B + 18}" text-anchor="middle" font-size="11" fill="#586073">${Math.round(mx * t)}</text>`).join("")}
    <text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#2a3142">pairs N(N-1)/2</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#2a3142">total time (ms)</text>
    <polyline fill="none" stroke="#1f56d6" stroke-width="2.5" points="${pts.map((p) => p.join(",")).join(" ")}"/>
    ${rows.map((r, i) => `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="4.5" fill="#faf7f0" stroke="#1f56d6" stroke-width="2.2"><title>N=${r.n}: ${r.total_ms} ms for ${r.pairs} pairs</title></circle><text x="${pts[i][0]}" y="${pts[i][1] - 10}" text-anchor="middle" font-size="11" fill="#2a3142">N=${r.n}</text>`).join("")}</svg>`;
}

/* ---------------------------------------------------------------- boot */
function setRole(role) {
  state.role = role; state.analysis = null;
  document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.role === role));
  $("#userWrap").hidden = role !== "student"; route();
}
async function boot() {
  document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => setRole(b.dataset.role)));
  $("#assignment").onchange = (e) => { state.aid = +e.target.value; state.analysis = null; render(); };
  $("#user").onchange = (e) => { state.userId = +e.target.value; render(); };
  $("#modalClose").onclick = closeModal;
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  window.addEventListener("hashchange", route);
  try { await loadBase(); } catch (e) { $("#view").innerHTML = `<div class="empty">The CodeLens server is not reachable. Start it with <code>python -m backend.app</code>.</div>`; return; }
  route();
}
boot();
