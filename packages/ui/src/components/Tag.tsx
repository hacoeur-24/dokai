import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

type Tone = 'default' | 'status' | 'version';
type Status = 'draft' | 'review' | 'stable' | 'deprecated' | 'archived';

const STATUS_VARS: Record<Status, { bg: string; fg: string }> = {
  draft: { bg: 'var(--tone-draft-bg)', fg: 'var(--tone-draft-fg)' },
  review: { bg: 'var(--tone-review-bg)', fg: 'var(--tone-review-fg)' },
  stable: { bg: 'var(--tone-stable-bg)', fg: 'var(--tone-stable-fg)' },
  deprecated: {
    bg: 'var(--tone-deprecated-bg)',
    fg: 'var(--tone-deprecated-fg)',
  },
  archived: { bg: 'var(--tone-archived-bg)', fg: 'var(--tone-archived-fg)' },
};

function statusPalette(value: ReactNode): { bg: string; fg: string } {
  const key = String(value).toLowerCase() as Status;
  return STATUS_VARS[key] ?? STATUS_VARS.draft;
}

export function Tag({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  const palette =
    tone === 'status'
      ? statusPalette(children)
      : { bg: 'var(--color-bg-muted)', fg: 'var(--color-fg-muted)' };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-[0.72rem] font-medium tracking-wide',
        tone === 'version' && 'font-mono',
      )}
      style={{ background: palette.bg, color: palette.fg }}
    >
      {children}
    </span>
  );
}
