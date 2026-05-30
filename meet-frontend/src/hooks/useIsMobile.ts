import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

const MOBILE_UA_PATTERNS = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint || MOBILE_UA_PATTERNS.test(navigator.userAgent);
  });

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < breakpoint || MOBILE_UA_PATTERNS.test(navigator.userAgent));
    };
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = () => check();
    mql.addEventListener('change', handler);
    check();
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}
