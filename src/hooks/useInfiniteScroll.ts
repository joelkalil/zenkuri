import { useCallback, useEffect, useRef } from 'react';

/** Ancestral rolável mais próximo; cai no scrollingElement do documento. */
export function findScrollParent(node: HTMLElement | null): HTMLElement {
  for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll')) return el;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

interface UseInfiniteScrollOptions {
  /** Chamado quando o sentinela entra na área observada. */
  onLoadMore: () => void;
  /** Muda a cada lote carregado para reobservar o sentinela, caso ele ainda esteja visível. */
  rearmKey?: number;
  rootMargin?: string;
}

/**
 * Retorna um ref callback para um elemento sentinela. Quando ele se aproxima da
 * viewport, `onLoadMore` é chamado. O observer é desconectado ao desmontar.
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
    // rearmKey recria o observer para disparar novamente se o sentinela continuar visível.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootMargin, rearmKey],
  );
}
