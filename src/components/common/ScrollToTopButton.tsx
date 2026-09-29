/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';

/**
 * ScrollToTopButton Component:
 * Floating "Scroll to Top" button that appears smoothly when scrolled down.
 * Positioned above mobile bottom navigation bar for optimal mobile ergonomics.
 */
export const ScrollToTopButton: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check window scroll position or document body scroll
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      if (scrolled > 250) {
        setShow(true);
      } else {
        setShow(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Also listen to potential main element scrolling
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    const mainEl = document.querySelector('main') || document.getElementById('root');
    if (mainEl) {
      mainEl.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  if (!show) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Kembali ke Atas"
      title="Kembali ke Atas"
      className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 p-3 bg-gradient-to-tr from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl shadow-xl shadow-emerald-900/30 border border-white/20 transition-all duration-300 active:scale-90 animate-in fade-in zoom-in cursor-pointer flex items-center justify-center gap-1 group"
    >
      <ChevronUp className="w-5 h-5 stroke-[2.5] group-hover:-translate-y-0.5 transition-transform" />
      <span className="text-[10px] font-black uppercase tracking-wider pr-1 hidden sm:inline">Top</span>
    </button>
  );
};
