import { useEffect, useState } from 'react'

export function useLoad(load, dependencies = []) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let mounted = true
    setState({ loading: true })
    load()
      .then((data) => mounted && setState({ data, loading: false }))
      .catch((error) => mounted && setState({ error: error.message, loading: false }))
    return () => {
      mounted = false
    }
    // Callers explicitly control refreshes; `load` is commonly an inline DTO adapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  return state
}
