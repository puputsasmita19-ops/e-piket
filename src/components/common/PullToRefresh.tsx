import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { sound, haptic } from '../../utils/feedback';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
}

const PULL_THRESHOLD = 70; // px needed to trigger refresh
const MAX_PULL = 110; // max drag displacement in px

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasVibrated, setHasVibrated] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAtTop = useCallback(() => {
    if (typeof window === 'undefined') return true;
    return window.scrollY <= 2 || document.documentElement.scrollTop <= 2 || document.body.scrollTop <= 2;
  }, []);

  const handleTouchStart = (e: React.TouchEvent | TouchEvent) => {
    if (disabled || isRefreshing) return;
    if (isAtTop()) {
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
      setHasVibrated(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent | TouchEvent) => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;
    if (!isAtTop()) {
      isDraggingRef.current = false;
      setPullDistance(0);
      return;
    }

    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0) {
      // Damping resistance formula
      const damping = 0.5;
      const calculatedDistance = Math.min(MAX_PULL, diff * damping);
      setPullDistance(calculatedDistance);

      // Trigger light haptic once threshold is crossed
      if (calculatedDistance >= PULL_THRESHOLD && !hasVibrated) {
        haptic.light();
        setHasVibrated(true);
      }
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;
    isDraggingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.85); // hold in place while refreshing
      haptic.success();

      try {
        await Promise.resolve(onRefresh());
        sound.playSuccess();
      } catch (err) {
        console.warn('Pull-to-refresh execution error:', err);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setHasVibrated(false);
        }, 400);
      }
    } else {
      setPullDistance(0);
      setHasVibrated(false);
    }
  };

  // Passive touch event listeners for highest scroll performance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
    const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
    const onTouchEnd = () => handleTouchEnd();

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [disabled, isRefreshing, pullDistance, onRefresh, isAtTop, hasVibrated]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isReady = pullDistance >= PULL_THRESHOLD;

  return (
    <div ref={containerRef} className="relative min-h-screen flex flex-col w-full">
      {/* Pull Indicator Badge */}
      {(pullDistance > 5 || isRefreshing) && (
        <div
          className="fixed top-14 sm:top-16 inset-x-0 z-50 flex items-center justify-center pointer-events-none transition-all duration-150 ease-out"
          style={{
            transform: `translateY(${Math.max(0, pullDistance - 20)}px)`,
            opacity: Math.min(1, Math.max(0, (pullDistance - 10) / 40))
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 border border-emerald-500/30 shadow-xl backdrop-blur-md text-slate-800 dark:text-slate-100 text-xs font-bold transition-all">
            <div
              className={`p-1.5 rounded-full ${
                isReady || isRefreshing
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {isRefreshing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <ArrowDown
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{
                    transform: `rotate(${isReady ? 180 : progress * 180}deg)`
                  }}
                />
              )}
            </div>

            <span className="text-[11px] font-extrabold tracking-tight">
              {isRefreshing
                ? 'Menyegarkan data e-Piket...'
                : isReady
                ? 'Lepaskan untuk menyegarkan'
                : 'Tarik ke bawah untuk refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Main App Layout Container */}
      <div
        className="flex-1 flex flex-col w-full transition-transform duration-200 ease-out"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
};
