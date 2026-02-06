import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * Custom hook for infinite scroll pagination
 * @param {Function} fetchFunction - Async function that fetches data (receives offset and limit)
 * @param {Object} dependencies - Dependencies that should trigger a reset (filters, etc.)
 * @param {number} pageSize - Number of items per page (default: 50)
 */
export function useInfiniteScroll(fetchFunction, dependencies = {}, pageSize = 50) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const observerTarget = useRef(null);

  // Memoize dependencies to prevent unnecessary resets
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depsString = useMemo(() => JSON.stringify(dependencies), [JSON.stringify(dependencies)]);

  // Reset when dependencies change
  useEffect(() => {
    setData([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
  }, [depsString]);

  // Load more data
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);

      const newData = await fetchFunction(offset, pageSize);

      if (newData.length < pageSize) {
        setHasMore(false);
      }

      setData(prev => {
        // If offset is 0, replace data (filter changed)
        if (offset === 0) {
          return newData;
        }
        // Otherwise append
        return [...prev, ...newData];
      });

      setOffset(prev => prev + newData.length);
    } catch (err) {
      console.error('Error loading more data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, offset, pageSize, loading, hasMore]);

  // Initial load
  useEffect(() => {
    if (data.length === 0 && !loading) {
      loadMore();
    }
  }, [data.length, loading]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, loading, loadMore]);

  return {
    data,
    loading,
    error,
    hasMore,
    observerTarget,
    reload: () => {
      setData([]);
      setOffset(0);
      setHasMore(true);
    },
  };
}
