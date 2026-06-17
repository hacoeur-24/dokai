import { useState, type ReactNode } from 'react';
import { ChevronDown, Type, AlignLeft, Hash, Activity, User, Tag as TagIcon } from 'lucide-react';
import type { Frontmatter } from 'dokai-core';
import { Tag } from './Tag.js';
import { cn } from '../lib/cn.js';
import { useT } from '../i18n/index.js';

const STATUSES = ['draft', 'review', 'stable', 'deprecated', 'archived'] as const;

export function FrontmatterForm({
  value,
  onChange,
  defaultCollapsed = false,
}: {
  value: Frontmatter;
  onChange: (next: Frontmatter) => void;
  defaultCollapsed?: boolean;
}) {
  const t = useT();
  const [tagInput, setTagInput] = useState('');
  const [open, setOpen] = useState(!defaultCollapsed);

  const update = (patch: Partial<Frontmatter>): void => {
    onChange({ ...value, ...patch });
  };

  const addTag = (): void => {
    const t = tagInput.trim();
    if (!t || value.tags.includes(t)) {
      setTagInput('');
      return;
    }
    update({ tags: [...value.tags, t] });
    setTagInput('');
  };

  const removeTag = (t: string): void => {
    update({ tags: value.tags.filter((tag) => tag !== t) });
  };

  return (
    <section className="rounded-card border bg-bg-subtle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">
            {t('frontmatter.fileHeader')}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-fg-subtle)' }}>
            {value.tags.length > 0
              ? `${t(value.tags.length === 1 ? 'frontmatter.tagsCount' : 'frontmatter.tagsCountPlural', { count: value.tags.length })} · `
              : ''}
            v{value.version}
            {value.status ? ` · ${t(`status.${value.status}`)}` : ''}
          </span>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform', open ? '' : '-rotate-90')}
          style={{ color: 'var(--color-fg-muted)' }}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t px-5 py-4">
          <Field icon={<Type className="h-3.5 w-3.5" />} label={t('frontmatter.title')}>
            <input
              type="text"
              value={value.title}
              onChange={(e) => update({ title: e.target.value })}
              className="dokai-control"
            />
          </Field>

          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label={t('frontmatter.description')}>
            <textarea
              value={value.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={2}
              className="dokai-control"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field icon={<Hash className="h-3.5 w-3.5" />} label={t('frontmatter.version')}>
              <input
                type="text"
                value={value.version}
                onChange={(e) => update({ version: e.target.value })}
                className="dokai-control font-mono"
              />
            </Field>
            <Field icon={<Activity className="h-3.5 w-3.5" />} label={t('frontmatter.status')}>
              <select
                value={value.status ?? ''}
                onChange={(e) =>
                  update({
                    status: (e.target.value || undefined) as Frontmatter['status'],
                  })
                }
                className="dokai-control"
              >
                <option value="">—</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            icon={<User className="h-3.5 w-3.5" />}
            label={t('frontmatter.owner', { optional: t('common.optional') })}
          >
            <input
              type="text"
              value={value.owner ?? ''}
              onChange={(e) => update({ owner: e.target.value || undefined })}
              className="dokai-control"
            />
          </Field>

          {/* Tags field is intentionally NOT wrapped in <Field> (which uses <label>). When a
              <label> contains <button> elements, the first button becomes the implicit form
              control and clicking on label whitespace fires that button's onClick — which here
              would silently delete the first tag. We use a plain <div> instead. */}
          <div className="block">
            <span
              className="mb-1 flex items-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--color-fg-muted)' }}
            >
              <TagIcon className="h-3.5 w-3.5" />
              {t('frontmatter.tags')}
            </span>
            <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-control border bg-(--color-surface) px-1.5 py-1 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--color-accent)_25%,transparent)]">
              {value.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="cursor-pointer"
                  title={t('frontmatter.removeTag', { tag })}
                >
                  <Tag>{tag} ×</Tag>
                </button>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={value.tags.length === 0 ? t('frontmatter.addTag') : ''}
                className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1 flex items-center gap-1.5 text-xs font-medium"
        style={{ color: 'var(--color-fg-muted)' }}
      >
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
