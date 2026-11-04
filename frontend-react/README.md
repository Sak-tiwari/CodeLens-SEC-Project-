# CodeLens UI (React + Tailwind + Lucide)

A second front end for the CodeLens Flask API: Dashboard, Similarity workspace, Settings.
The original no-build dashboard in `../frontend` is unchanged and still what `python -m backend.app` serves.

## Run
```
# terminal 1 (repo root)
python -m backend.app            # API on :5000
# terminal 2
cd frontend-react
npm install
npm run dev                      # http://localhost:5173, /api is proxied to :5000
```
`API_URL=http://127.0.0.1:5077 npm run dev` points the proxy at another port. `npm run build` writes `dist/`.

## Structure
```
src/
  index.css            design tokens (light + dark) and Tailwind theme
  lib/                 api.js, useAsync.js, app-context.jsx (theme, settings, assignment), status.js
  components/          ui.jsx (Button, Card, Tabs, Drawer, EmptyState, ErrorBanner, Skeleton...),
                       AppShell.jsx (sidebar + mobile drawer + header), Heatmap.jsx, PairDrawer.jsx, ErrorBoundary.jsx
  views/               Dashboard.jsx, Workspace.jsx, Settings.jsx
```
Settings are stored in the browser (localStorage) and used as the defaults for every analysis.
There is no real sign-in: requests send `X-Role: instructor`, the same mock role switch as the original dashboard.
