/** Thin fetch wrapper for the CodeLens Flask API. The role header is the project's mock auth. */
export async function api(path, { body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: body ? "POST" : "GET",
      signal,
      headers: { "X-Role": "instructor", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error("Cannot reach the CodeLens server. Start it with `python -m backend.app`.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function analysisQuery({ threshold, candidate, n, weights }) {
  const q = new URLSearchParams({ threshold, candidate, n });
  Object.entries(weights).forEach(([k, v]) => q.set(`w_${k}`, v));
  return q.toString();
}
