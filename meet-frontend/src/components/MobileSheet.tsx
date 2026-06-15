import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function MobileSheet({ open, onClose, children, title }: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const scrollYRef = useRef(0);

  const lockBody = useCallback(() => {
    scrollYRef.current = window.scrollY;
    document.body.classList.add('scroll-locked');
    document.body.style.top = `-${scrollYRef.current}px`;
  }, []);

  const unlockBody = useCallback(() => {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    if (scrollYRef.current) {
      window.scrollTo(0, scrollYRef.current);
      scrollYRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (open) {
      lockBody();
    }
    return () => {
      if (open) unlockBody();
    };
  }, [open, lockBody, unlockBody]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const onResize = () => {
      if (window.visualViewport) {
        document.documentElement.style.setProperty('--vh', `${window.visualViewport.height}px`);
      }
    };

    onResize();
    window.visualViewport.addEventListener('resize', onResize);
    window.visualViewport.addEventListener('scroll', onResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
      document.documentElement.style.removeProperty('--vh');
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    if (diff > 0 && sheetRef.current) {
      e.preventDefault();
      sheetRef.current.style.transform = `translateY(${diff}px)`;
      sheetRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = () => {
    if (!sheetRef.current) return;
    const diff = currentY.current - startY.current;
    sheetRef.current.style.transition = '';
    if (diff > 80) {
      onClose();
    }
    sheetRef.current.style.transform = '';
    startY.current = 0;
    currentY.current = 0;
  };

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50" style={{ top: `-${scrollYRef.current}px` }}>
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="mobile-sheet absolute inset-x-0 bottom-0 bg-surface-800 rounded-t-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: 'calc(var(--vh, 100dvh) - 70px)' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-1 rounded-full bg-surface-600" />
            {title && (
              <span className="text-sm font-medium text-surface-100 ml-2">{title}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
          {children}
        </div>
      </div>
    </div>
  );
}
