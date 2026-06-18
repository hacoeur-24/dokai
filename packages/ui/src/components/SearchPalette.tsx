import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import MiniSearch from 'minisearch';
import { useNavigate } from 'react-router-dom';
import { Folder, SlidersHorizontal } from 'lucide-react';
import { fetchSearchIndex, type SearchIndexPayload } from '../lib/api.js';
import { Tag } from './Tag.js';
import { Dropdown, type DropdownOption } from './Dropdown.js';
import { useT } from '../i18n/index.js';

const OPTIONS = {
  fields: ['title', 'description', 'tags', 'headings', 'body'],
  storeFields: [
    'title',
    'description',
    'tags',
    'version',
    'status',
    'package',
    'route',
    'folderPath',
    'folderTitle',
  ],
  searchOptions: {
    boost: { title: 4, headings: 2, description: 1.5 },
    fuzzy: 0.15,
    prefix: true,
  },
};

interface Result {
  id: string;
  title: string;
  description: string;
  tags: string[];
  version: string;
  status?: string;
  package: string | null;
  route: string;
  folderPath: string;
  folderTitle: string;
}

/** Group results in result-order so the folder containing the top hit shows first. Within each
 *  group, items keep their relevance ordering. */
interface ResultGroup {
  folderPath: string;
  folderTitle: string;
  items: Result[];
}

function groupByFolder(results: Result[]): ResultGroup[] {
  const order: string[] = [];
  const map = new Map<string, ResultGroup>();
  for (const r of results) {
    const key = r.folderPath ?? '';
    let group = map.get(key);
    if (!group) {
      group = { folderPath: key, folderTitle: r.folderTitle ?? '', items: [] };
      map.set(key, group);
      order.push(key);
    }
    group.items.push(r);
  }
  return order.map((k) => map.get(k)!);
}

export function SearchPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [indexFile, setIndexFile] = useState<SearchIndexPayload | null>(null);
  const [search, setSearch] = useState<MiniSearch<Result> | null>(null);
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Re-fetch the index every time the palette opens. The index is small enough that this is
  // cheap, and re-fetching guarantees that newly added tags / docs / status changes show up
  // without the user having to refresh the page.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchSearchIndex().then((file) => {
      if (cancelled) return;
      setIndexFile(file);
      const mini = MiniSearch.loadJS<Result>(file.index as never, OPTIONS);
      setSearch(mini);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const allTags = indexFile?.tags ?? [];
  const allStatuses = indexFile?.statuses ?? [];
  const allVersions = useMemo(() => {
    if (!indexFile) return [];
    const set = new Set<string>();
    for (const d of indexFile.documents) set.add(d.version);
    return [...set].sort();
  }, [indexFile]);

  const results: Result[] = useMemo(() => {
    if (!search || !indexFile) return [];
    const base: Result[] =
      query.trim().length === 0
        ? (indexFile.documents as Result[])
        : (search.search(query, { combineWith: 'AND' }) as unknown as Result[]);

    return base
      .filter((r) => {
        if (activeTags.length > 0 && !activeTags.every((t) => r.tags.includes(t))) return false;
        if (activeStatus && r.status !== activeStatus) return false;
        if (activeVersion && r.version !== activeVersion) return false;
        return true;
      })
      .slice(0, 40);
  }, [search, indexFile, query, activeTags, activeStatus, activeVersion]);

  const groups = useMemo(() => groupByFolder(results), [results]);

  const navigate = useNavigate();
  const t = useT();
  if (!open) return null;

  const hasFilters = allTags.length > 0 || allStatuses.length > 0 || allVersions.length > 1;

  const toggleTag = (tag: string): void =>
    setActiveTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <Command
        loop
        className="w-full max-w-2xl overflow-hidden rounded-card border bg-bg"
        style={{ boxShadow: 'var(--shadow-pop)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b">
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder={t('search.placeholder')}
            className="min-w-0 flex-1 bg-transparent px-5 py-4 text-[0.95rem] outline-none placeholder:text-fg-subtle"
          />
          {hasFilters && (
            <button
              type="button"
              title={t('search.filters')}
              aria-label={t('search.filters')}
              aria-pressed={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
              className="mr-3 flex shrink-0 items-center rounded-control p-1.5 transition-colors"
              style={{
                color: filtersOpen ? 'var(--color-accent)' : 'var(--color-fg-subtle)',
                background: filtersOpen
                  ? 'color-mix(in oklch, var(--color-accent) 12%, transparent)'
                  : undefined,
              }}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {filtersOpen && hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2 text-xs">
            {allStatuses.length > 0 && (
              <DropdownFilter
                label={t('search.statusLabel')}
                allLabel={t('search.allOption')}
                options={allStatuses}
                value={activeStatus}
                onChange={setActiveStatus}
              />
            )}
            {allVersions.length > 1 && (
              <DropdownFilter
                label={t('search.versionLabel')}
                allLabel={t('search.allOption')}
                options={allVersions}
                value={activeVersion}
                onChange={setActiveVersion}
              />
            )}
            {allTags.length > 0 && (allStatuses.length > 0 || allVersions.length > 1) && (
              <span
                aria-hidden="true"
                className="mx-1 h-4 w-px self-center"
                style={{ background: 'var(--color-border)' }}
              />
            )}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {allTags.slice(0, 12).map((t) => {
                  const active = activeTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className="cursor-pointer"
                    >
                      <span
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem]"
                        style={{
                          background: active
                            ? 'color-mix(in oklch, var(--color-accent) 18%, transparent)'
                            : 'var(--color-bg-subtle)',
                          color: active ? 'var(--color-accent)' : 'var(--color-fg-muted)',
                          borderColor: active ? 'var(--color-accent)' : undefined,
                        }}
                      >
                        {t}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <Command.List className="dokai-scroll max-h-[55vh] overflow-y-auto px-2 py-2">
          {results.length === 0 && query && (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--color-fg-subtle)' }}>
              {t('search.noResults', { query })}
            </p>
          )}
          {results.length === 0 && !query && (
            <p className="px-4 py-6 text-sm" style={{ color: 'var(--color-fg-subtle)' }}>
              {t('search.empty')}
            </p>
          )}
          {/* Use cmdk's <Command.Group> for grouping — wrapping items in plain <div>s breaks
              cmdk's internal DOM tracking and crashes with "Failed to execute 'appendChild'".
              The heading prop accepts a ReactNode, so we render the folder icon + title as JSX. */}
          {groups.map((group) => (
            <Command.Group
              key={group.folderPath || '__root__'}
              heading={
                <span
                  className="dokai-eyebrow inline-flex items-center gap-1.5 text-[0.65rem]"
                  style={{ color: 'var(--color-fg-subtle)' }}
                  title={group.folderPath || undefined}
                >
                  <Folder className="h-3 w-3" />
                  <span className="truncate">
                    {group.folderTitle || t('sidebar.documentation')}
                  </span>
                </span>
              }
            >
              {group.items.map((result) => (
                <Command.Item
                  key={result.id}
                  value={`${result.title} ${result.description} ${result.tags.join(' ')} ${result.route}`}
                  onSelect={() => {
                    onOpenChange(false);
                    navigate(result.route);
                  }}
                  className="group flex cursor-pointer items-start justify-between rounded-control px-3 py-2.5 aria-selected:bg-bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{result.title}</div>
                    <div className="truncate text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                      {result.description}
                    </div>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-1.5">
                    {result.package && <Tag>{result.package}</Tag>}
                    {result.status && <Tag tone="status">{result.status}</Tag>}
                    <Tag tone="version">v{result.version}</Tag>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function DropdownFilter({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const dropdownOptions: DropdownOption<string>[] = [
    { value: '', label: allLabel },
    ...options.map((o) => ({ value: o, label: o })),
  ];
  return (
    <label className="flex items-center gap-1.5">
      <span className="dokai-eyebrow text-[0.65rem]">{label}</span>
      <Dropdown
        value={value ?? ''}
        options={dropdownOptions}
        onChange={(v) => onChange(v || null)}
      />
    </label>
  );
}
