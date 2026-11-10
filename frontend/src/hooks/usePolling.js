import { useEffect, useState } from 'react'

/**
 * Fetches JSON from `url` now and then every `intervalMs`.
 * Returns { data, error, fetchedAt }. Keeps the last good data if a later fetch fails.
 * Skips fetching while the browser tab is hidden.
 */
export function usePolling(url, intervalMs) {
  const [state, setState] = useState({ data: null, error: null, fetchedAt: null })

  useEffect(() => {
    let cancelled = false
    let controller = null

    async function load() {
      if (document.hidden) return
      controller?.abort()
      controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (!cancelled) setState({ data, error: null, fetchedAt: Date.now() })
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setState((previous) => ({ ...previous, error }))
        }
      } finally {
        clearTimeout(timeout)
      }
    }

    load()
    const timer = setInterval(load, intervalMs)
    const onVisible = () => !document.hidden && load()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      controller?.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [url, intervalMs])

  return state
}
