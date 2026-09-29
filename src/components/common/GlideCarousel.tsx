/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface GlideCarouselProps {
  children: React.ReactNode;
  title?: string;
  badge?: string;
  className?: string;
  itemClassName?: string;
}

/**
 * GlideCarousel Component:
 * Compact horizontal glide / slider for lists with many items (e.g. Log Aktivitas, Riwayat, Incidents).
 * Allows touch-swiping, snap scrolling, and glide buttons for a sleek mobile UX.
 */
export const GlideCarousel: React.FC<GlideCarouselProps> = ({
  children,
  title,
  badge,
  className = '',
  itemClassName = 'w-[82%] sm:w-[320px]'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const itemCount = React.Children.count(children);

  const updateScrollState = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);

    // Calculate active slide index
    const cardWidth = clientWidth * 0.8;
    const index = Math.round(scrollLeft / (cardWidth || 1));
    setActiveIndex(Math.min(Math.max(index, 0), itemCount - 1));
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState, { passive: true });
      updateScrollState();
      return () => el.removeEventListener('scroll', updateScrollState);
    }
  }, [children]);

  const glide = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  if (itemCount === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header with Glide Navigation Buttons */}
      {(title || badge) && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            {title && <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h3>}
            {badge && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                {badge}
              </span>
            )}
          </div>

          {/* Glide Left / Right Arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => glide('left')}
              disabled={!canScrollLeft}
              aria-label="Glide Kiri"
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => glide('right')}
              disabled={!canScrollRight}
              aria-label="Glide Kanan"
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Swipeable Snap Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory py-1.5 px-0.5 no-scrollbar scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {React.Children.map(children, (child, idx) => (
          <div
            key={idx}
            className={`shrink-0 snap-start transition-all duration-200 ${itemClassName}`}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Glide Indicator Dots */}
      {itemCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {Array.from({ length: Math.min(itemCount, 8) }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-5 bg-emerald-600 dark:bg-emerald-400'
                  : 'w-1.5 bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
