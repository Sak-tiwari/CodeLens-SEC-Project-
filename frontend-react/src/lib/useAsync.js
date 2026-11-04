import { useCallback, useEffect, useRef, useState } from "react";

/** Runs `fn(signal)` whenever `deps` change. Stale responses are ignored; `reload` re-runs it. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const run = useCallback(() => {
    const my = ++seq.current, ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve(fn(ctl.signal))
      .then((data) => my === seq.current && setState({ data, error: null, loading: false }))
      .catch((error) => error.name !== "AbortError" && my === seq.current && setState((s) => ({ ...s, error, loading: false })));
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => run(), [run]);
  return { ...state, reload: run };
}
