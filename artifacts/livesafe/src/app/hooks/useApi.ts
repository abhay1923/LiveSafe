import { useState, useEffect, useCallback, useRef } from 'react'

interface UseApiState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

export interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => void
}

/**
 * Generic data-fetching hook.
 * - AbortController cleans up on unmount / refetch
 * - Stable `refetch` identity via useCallback
 * - Error normalised to Error instance always
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: true,
    error: null,
  })
  const [refetchCounter, setRefetchCounter] = useState(0)
  // Keep a stable ref to fetcher so the effect doesn't re-run on every render
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setState((prev: UseApiState<T>) => ({ ...prev, isLoading: true, error: null }))

    fetcherRef.current(controller.signal)
      .then((data: T) => {
        if (!cancelled) setState({ data, isLoading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          })
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [refetchCounter])

  const refetch = useCallback(() => setRefetchCounter((c: number) => c + 1), [])
  return { ...state, refetch }
}
