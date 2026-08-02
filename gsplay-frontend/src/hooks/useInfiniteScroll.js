import { useEffect, useRef } from 'react'

export default function useInfiniteScroll({ hasMore, loading, onLoadMore }) {
  const sentinelRef = useRef(null)

  useEffect(() => {
    const target = sentinelRef.current
    if (!target || !hasMore || loading) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore()
      },
      { rootMargin: '280px' }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loading, onLoadMore])

  return sentinelRef
}
