import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useRef, useState, type ReactNode } from 'react';

/**
 * App-wide provider for Radix tooltips. Mounted once near the root so every tooltip shares a single
 * open-delay timer — moving between adjacent rows within the skip window reveals the next tooltip
 * instantly instead of waiting out the full delay again.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={350} skipDelayDuration={250}>
      {children}
    </RadixTooltip.Provider>
  );
}

export interface OverflowTooltipProps {
  /** Text rendered in the truncating label and shown in full inside the tooltip. */
  text: string;
  /** Class names for the label span. Must apply truncation (overflow/ellipsis/nowrap). */
  className?: string;
  /** Preferred side for the bubble. Defaults to `right` (the sidebar hugs the left edge). */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * A truncating text label that reveals its full text in a portal-rendered tooltip — but only when
 * the text is actually clipped (`scrollWidth > clientWidth`). The portal lets the bubble escape the
 * sidebar's `overflow` clipping and grow wider than the sidebar; the truncation gate avoids a
 * redundant tooltip on names that already fit. Replaces the native `title` attribute on rows.
 */
export function OverflowTooltip({ text, className, side = 'right' }: OverflowTooltipProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <RadixTooltip.Root
      open={open}
      onOpenChange={(next) => {
        const el = labelRef.current;
        // Only open when the label is genuinely truncated; otherwise keep it closed.
        setOpen(next && !!el && el.scrollWidth > el.clientWidth);
      }}
    >
      <RadixTooltip.Trigger asChild>
        <span ref={labelRef} className={className}>
          {text}
        </span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="dokai-tooltip"
          side={side}
          sideOffset={6}
          collisionPadding={8}
        >
          {text}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
