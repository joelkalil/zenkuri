import { useCallback, useEffect, useRef } from 'react';

/** Nearest scrollable ancestor; falls back to the document's scrollingElement. */
export function findScrollParent(node: HTMLElement | null): HTMLElement {
  for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll')) return el;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

interface UseInfiniteScrollOptions {
  /** Called when the sentinel enters the observed area. */
  onLoadMore: () => void;
  /** Changes with every loaded batch to re-observe the sentinel in case it is still visible. */
  rearmKey?: number;
  rootMargin?: string;
}

/**
 * Returns a ref callback for a sentinel element. When it approaches the
 * viewport, `onLoadMore` is called. The observer is disconnected on unmount.
 */
export function useInfiniteScroll({ onLoadMore, rearmKey = 0, rootMargin = '800px 0px' }: UseInfiniteScrollOptions) {
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  return useCallback(
    (node: HTMLElement | null) => {
      if (!node || typeof IntersectionObserver === 'undefined') return undefined;
      const scroller = findScrollParent(node);
      const isDocument = scroller === document.scrollingElement || scroller === document.documentElement;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
        },
        { root: isDocument ? null : scroller, rootMargin },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    // rearmKey recreates the observer so it fires again if the sentinel is still visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootMargin, rearmKey],
  );
}
