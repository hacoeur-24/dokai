import { Info } from 'lucide-react';
import { type ReactNode } from 'react';

export interface InfoTipProps {
  /** The tooltip content displayed on hover and focus. */
  content: ReactNode;
  /** Accessible label for the trigger button. Defaults to "More information". */
  label?: string;
}

/**
 * Small inline info icon that reveals a tooltip bubble on hover and focus (a11y).
 * Implemented as CSS-only (no Radix portal) so it sits inline beside a label without
 * shifting layout. The bubble uses `.dokai-tooltip` which applies inverted tokens.
 */
export function InfoTip({ content, label = 'More information' }: InfoTipProps) {
  return (
    <span className="dokai-infotip">
      <button
        type="button"
        className="dokai-infotip__trigger"
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span role="tooltip" className="dokai-tooltip dokai-infotip__bubble">
        {content}
      </span>
    </span>
  );
}
