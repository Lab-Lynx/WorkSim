import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const APP_TITLE_SUFFIX = 'Work Simulator';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    if (title && title.trim()) {
      document.title = `${title.trim()} · ${APP_TITLE_SUFFIX}`;
    } else {
      document.title = APP_TITLE_SUFFIX;
    }
  }, [title]);
}

/**
 * useFocusPageHeading — Route-change accessibility from Doc 6 §6.5.8 & Doc 10 §10.13.
 * Called by both layouts (AppLayout and AuthLayout).
 * When location.pathname changes (not on first load, and not on a search-only or hash-only change),
 * it focuses the first h1 inside main. Pages give that heading tabIndex={-1}.
 * If there is no h1, it does nothing.
 */
export function useFocusPageHeading(): void {
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevPathnameRef.current = pathname;
      return;
    }

    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      const heading = document.querySelector<HTMLElement>('main h1');
      if (heading) {
        heading.focus();
      }
    }
  }, [pathname]);
}

export default useDocumentTitle;
