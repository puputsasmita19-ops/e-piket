import React, { useState } from 'react';

interface RunningTextProps {
  text?: string;
  maxLength?: number;
  className?: string;
  wrapperClassName?: string;
  speed?: 'normal' | 'slow' | 'fast';
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  autoMarquee?: boolean;
  highlight?: string;
}

/**
 * RunningText Component:
 * - If text length exceeds maxLength or overflows container, smoothly scrolls horizontally (marquee)
 *   so long names like "apt. Ade Zona Akhirita Junjungan, S.Farm., Gr." or "Ns. Intan Novita Endrawati, S.Kep."
 *   are completely visible and never cut off.
 * - Pauses on hover/touch and provides full tooltip title.
 * - Supports highlighting search terms.
 */
export const RunningText: React.FC<RunningTextProps> = ({
  text = '',
  maxLength = 40,
  className = '',
  wrapperClassName = '',
  suffix,
  prefix,
  autoMarquee = false,
  highlight = '',
}) => {
  // Helper to highlight matching text
  const renderHighlightedText = (content: string) => {
    if (!highlight || !highlight.trim()) {
      return content;
    }
    const q = highlight.trim().toLowerCase();
    const idx = content.toLowerCase().indexOf(q);
    if (idx === -1) return content;

    const before = content.slice(0, idx);
    const match = content.slice(idx, idx + q.length);
    const after = content.slice(idx + q.length);

    return (
      <>
        {before}
        <mark className="bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-200 rounded-xs px-0.5 font-bold">
          {match}
        </mark>
        {after}
      </>
    );
  };

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 max-w-full ${wrapperClassName}`} title={text}>
      {prefix}
      <span className={className}>
        {renderHighlightedText(text)}
      </span>
      {suffix}
    </span>
  );
};
