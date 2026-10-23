import { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, ArrowRight } from 'lucide-react';
import { useBrowser } from '@/store/browser-store';
import { search as searchApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SearchEngine, Suggestion } from '@shared/types';

export function SearchWidget() {
  const { createTab, settingsData, updateSettings } = useBrowser();
  const [value, setValue] = useState('');
  const [engines, setEngines] = useState<SearchEngine[]>([]);
  const [engineId, setEngineId] = useState<string>('duckduckgo');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [engineMenuOpen, setEngineMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void searchApi.engines().then(setEngines).catch(() => undefined);
  }, []);

  useEffect(() => {
    const configured = (settingsData?.search?.engineId as string) || 'duckduckgo';
    setEngineId(configured);
  }, [settingsData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim()) void searchApi.suggest(value).then(setSuggestions).catch(() => setSuggestions([]));
      else setSuggestions([]);
    }, 120);
    return () => clearTimeout(timer);
  }, [value]);

  const submit = (text: string) => {
    const query = text.trim();
    if (!query) return;
    void createTab(query);
    setValue('');
    setOpen(false);
  };

  const activeEngine = engines.find((e) => e.id === engineId) ?? engines[0];

  return (
    <div className="relative w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex h-12 items-center gap-2 rounded-full border border-white/15 bg-black/30 px-2 backdrop-blur-md transition-colors focus-within:border-white/30"
      >
        <button
          type="button"
          onClick={() => setEngineMenuOpen((v) => !v)}
          onBlur={() => setTimeout(() => setEngineMenuOpen(false), 150)}
          className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10"
          aria-label="Choose search engine"
        >
          {activeEngine?.name ?? 'Search'}
          <ChevronDown size={14} className="opacity-60" />
        </button>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search the web or enter a URL"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-white/50 outline-none"
          aria-label="Search the web or enter a URL"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Search size={16} />
        </button>
      </form>

      {engineMenuOpen ? (
        <div className="animate-scale-in absolute left-0 top-14 z-20 w-56 overflow-hidden rounded-xl border border-white/10 bg-[var(--color-surface-elevated)] p-1 shadow-2xl">
          {engines.map((engine) => (
            <button
              key={engine.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setEngineId(engine.id);
                setEngineMenuOpen(false);
                void updateSettings({ search: { engineId: engine.id } });
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--color-surface-overlay)]',
                engine.id === engineId ? 'text-accent' : 'text-[var(--color-text)]',
              )}
            >
              {engine.name}
              <span className="text-[11px] text-[var(--color-text-subtle)]">{engine.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      {open && suggestions.length > 0 ? (
        <div className="animate-scale-in absolute left-0 right-0 top-14 z-20 overflow-hidden rounded-xl border border-white/10 bg-[var(--color-surface-elevated)] p-1 shadow-2xl">
          {suggestions.slice(0, 7).map((s, i) => (
            <button
              key={`${s.url}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(s.url)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-overlay)]"
            >
              <ArrowRight size={13} className="shrink-0 text-[var(--color-text-subtle)]" />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <span className="shrink-0 text-[11px] text-[var(--color-text-subtle)]">{s.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
