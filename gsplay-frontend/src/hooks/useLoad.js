import { useEffect, useState } from 'react';

export function useLoad(load, dependencies = []) {
  const [state, setState] = useState({ loading: true });
  // Callers explicitly define when a request is refreshed; `load` is commonly an inline DTO adapter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let mounted = true;
    setState({ loading: true });
    load().then((data) => mounted && setState({ data, loading: false })).catch((error) => mounted && setState({ error: error.message, loading: false }));
    return () => { mounted = false; };
  }, dependencies);
  return state;
}