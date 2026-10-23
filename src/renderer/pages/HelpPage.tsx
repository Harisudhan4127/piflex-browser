import { useState } from 'react';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import { InternalPageLayout } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { useBrowser } from '@/store/browser-store';
import { cn } from '@/lib/utils';
import { HELP_TOPICS } from './help-content';

export function HelpPage() {
  const [activeId, setActiveId] = useState(HELP_TOPICS[0]?.id ?? 'description');
  const active = HELP_TOPICS.find((topic) => topic.id === activeId) ?? HELP_TOPICS[0];

  return (
    <InternalPageLayout
      page="help"
      title="Help"
      subtitle="How PiFlex Browser works, and what it does and does not do"
      constrain={false}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => useBrowser.getState().setPanel('ai')}
        >
          <Sparkles size={13} /> Ask the assistant
        </Button>
      }
    >
      <div className="mx-auto flex h-full max-w-5xl gap-6 px-6 py-6">
        <nav aria-label="Help topics" className="hidden w-56 shrink-0 md:block">
          <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
            <BookOpen size={13} /> Topics
          </div>
          <ul className="space-y-0.5">
            {HELP_TOPICS.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(topic.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                    topic.id === active?.id
                      ? 'bg-[var(--color-surface-overlay)] text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-overlay)]/60 hover:text-[var(--color-text)]',
                  )}
                >
                  <span className="truncate">{topic.title}</span>
                  <ChevronRight size={13} className="shrink-0 opacity-50" />
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--color-text-subtle)]">
            PiFlex Browser
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">{active?.title}</h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{active?.summary}</p>

          <div className="mt-5 space-y-5">
            {active?.blocks.map((block, index) => (
              <section key={index}>
                {block.heading ? (
                  <h3 className="mb-1.5 text-[13px] font-semibold text-[var(--color-text)]">
                    {block.heading}
                  </h3>
                ) : null}
                {block.paragraphs?.map((paragraph, i) => (
                  <p
                    key={i}
                    className="mb-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]"
                  >
                    {paragraph}
                  </p>
                ))}
                {block.bullets ? (
                  <ul className="space-y-1.5">
                    {block.bullets.map((bullet, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-[13px] leading-relaxed text-[var(--color-text-muted)]"
                      >
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-1.5 md:hidden">
            {HELP_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveId(topic.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px]',
                  topic.id === active?.id
                    ? 'border-accent text-accent'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)]',
                )}
              >
                {topic.title}
              </button>
            ))}
          </div>

          <p className="mt-8 border-t border-[var(--color-border)] pt-3 text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
            This help is descriptive, not promotional. Features that require a model or a download
            only work after you enable them. PiFlex does not claim capabilities it has not implemented.
          </p>
        </article>
      </div>
    </InternalPageLayout>
  );
}
