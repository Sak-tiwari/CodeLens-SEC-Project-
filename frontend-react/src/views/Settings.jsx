import { useState } from "react";
import { CheckCircle2, Cpu, GitBranch, Plug, RotateCcw, SlidersHorizontal, User } from "lucide-react";
import { DEFAULT_SETTINGS, useApp } from "../lib/app-context";
import { Badge, Button, Card, CardHeader, Field, PageHeader, Select, Tabs, inputCls, cx } from "../components/ui";

const TABS = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "project", label: "Project", icon: Cpu },
];
const WEIGHT_LABELS = { raw: "Raw text", cosine: "Token cosine", ngram: "n-gram Jaccard", length: "Length ratio", lcs: "LCS" };

export default function SettingsView() {
  const { settings, saveSettings, theme, setTheme, health } = useApp();
  const [tab, setTab] = useState("account");
  const [draft, setDraft] = useState(settings);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const save = (e) => {
    e.preventDefault();
    const err = {};
    if (!draft.name.trim()) err.name = "Enter a display name.";
    if (!/^\S+@\S+\.\S+$/.test(draft.email)) err.email = "Enter a valid email address, like name@college.edu.";
    setErrors(err);
    if (Object.keys(err).length) { setTab("account"); return; }
    saveSettings(draft);
  };
  const sum = Object.values(draft.weights).reduce((a, b) => a + b, 0) || 1;

  return (
    <form onSubmit={save} noValidate className="animate-rise space-y-6">
      <PageHeader kicker="Configuration" title="Settings" text="Defaults are stored in this browser and used by every analysis."
        actions={<>
          <Button type="button" icon={RotateCcw} onClick={() => { setDraft(DEFAULT_SETTINGS); setErrors({}); }}>Reset to defaults</Button>
          <Button type="submit" variant="primary">Save changes</Button>
        </>} />

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-xl border border-danger-solid/40 bg-danger-bg px-4 py-3 text-sm font-medium text-danger">
          Fix {Object.keys(errors).length} {Object.keys(errors).length === 1 ? "field" : "fields"} before saving: {Object.values(errors).join(" ")}
        </div>
      )}

      <Card>
        <div className="px-3 sm:px-5"><Tabs tabs={TABS} value={tab} onChange={setTab} label="Settings sections" /></div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="p-5 sm:p-6">
          {tab === "account" && (
            <div className="grid max-w-xl gap-5">
              <Field label="Display name" error={errors.name}>{(id, a) => <input id={id} {...a} className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />}</Field>
              <Field label="Email" error={errors.email} hint="Used for review notifications. Never shown to students.">{(id, a) => <input id={id} {...a} type="email" className={inputCls} value={draft.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />}</Field>
              <Field label="Role" hint="This demo uses a role switch instead of real sign-in.">{(id) => <input id={id} className={cx(inputCls, "bg-surface-2 text-muted")} value="Instructor" readOnly />}</Field>
            </div>
          )}

          {tab === "preferences" && (
            <div className="grid max-w-xl gap-6">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-2">Theme</legend>
                <div className="inline-flex rounded-[10px] border border-line-strong bg-surface p-0.5" role="radiogroup" aria-label="Theme">
                  {["light", "dark"].map((t) => (
                    <button type="button" key={t} role="radio" aria-checked={theme === t} onClick={() => setTheme(t)}
                      className={cx("min-h-10 rounded-lg px-5 text-sm font-semibold capitalize transition-colors", theme === t ? "bg-brand text-on-brand" : "text-muted hover:text-ink")}>{t}</button>
                  ))}
                </div>
              </fieldset>
              <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Animations switch off automatically when your device is set to reduce motion.</p>
            </div>
          )}

          {tab === "integrations" && (
            <ul className="grid gap-4 md:grid-cols-2">
              <li className="rounded-xl border border-line p-5">
                <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><Cpu className="size-5 text-brand" aria-hidden="true" />GCC compiler</span>
                  {health?.gcc ? <Badge tone="brand"><CheckCircle2 className="mr-1 size-3.5" aria-hidden="true" />Connected</Badge> : <Badge tone="warning">Not found</Badge>}</div>
                <p className="text-sm text-muted">{health?.gcc || "Install GCC on the server to compile and test submissions."}</p>
              </li>
              <li className="rounded-xl border border-line p-5">
                <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-2 font-semibold"><GitBranch className="size-5 text-brand" aria-hidden="true" />GitHub repository</span><Badge>Planned</Badge></div>
                <p className="text-sm text-muted">Import submissions from a classroom repository. Not built yet.</p>
              </li>
            </ul>
          )}

          {tab === "project" && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-5">
                <h3 className="font-semibold">Detection thresholds</h3>
                <Field label={`Edge threshold: ${draft.threshold.toFixed(2)}`} hint="Pairs at or above this composite score become graph edges.">{(id) => <input id={id} type="range" min="0.3" max="1" step="0.01" value={draft.threshold} onChange={(e) => set("threshold", +e.target.value)} className="h-11 w-full accent-brand" />}</Field>
                <Field label={`Length filter: ${draft.candidate.toFixed(2)}`} hint="Skip pairs whose lengths differ too much.">{(id) => <input id={id} type="range" min="0" max="1" step="0.05" value={draft.candidate} onChange={(e) => set("candidate", +e.target.value)} className="h-11 w-full accent-brand" />}</Field>
                <Field label="n-gram size">{(id) => <Select id={id} value={draft.n} onChange={(e) => set("n", +e.target.value)} className="w-28">{[2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold">Composite weights <span className="text-sm font-normal text-muted">(normalised to 1 · current sum {sum.toFixed(2)})</span></h3>
                {Object.keys(WEIGHT_LABELS).map((k) => (
                  <Field key={k} label={`${WEIGHT_LABELS[k]}: ${draft.weights[k].toFixed(2)}`}>{(id) => <input id={id} type="range" min="0" max="1" step="0.05" value={draft.weights[k]} onChange={(e) => set("weights", { ...draft.weights, [k]: +e.target.value })} className="h-11 w-full accent-brand" />}</Field>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </form>
  );
}
