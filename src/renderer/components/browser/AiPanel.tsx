import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  Square,
  Download,
  Trash2,
  Check,
  AlertTriangle,
  Cpu,
  FileText,
  Languages,
  ListChecks,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { ai as aiApi, piflex } from '@/lib/api';
import { useBrowser } from '@/store/browser-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SimpleSelect } from '@/components/ui/select';
import { PanelShell, EmptyState } from './PanelShell';
import { cn, hostOf } from '@/lib/utils';
import type { AiInstalledModel, AiModelInfo, AiModelProgress, AiStatus } from '@shared/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const TRANSLATE_TARGETS = [
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Chinese (Simplified)', label: 'Chinese' },
  { value: 'Japanese', label: 'Japanese' },
];

function newRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function formatMB(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export function AiPanel({ onClose }: { onClose: () => void }) {
  const { settingsData, updateSettings, tabs, activeTabId } = useBrowser();
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const aiSettings = (settingsData?.ai ?? {}) as Record<string, unknown>;
  const aiEnabled = Boolean(aiSettings.enabled);
  const allowPage = aiSettings.allowPageContext !== false;

  const [view, setView] = useState<'chat' | 'models'>('chat');
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [catalog, setCatalog] = useState<AiModelInfo[]>([]);
  const [installed, setInstalled] = useState<AiInstalledModel[]>([]);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [progress, setProgress] = useState<Record<string, AiModelProgress>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePage, setIncludePage] = useState(allowPage);
  const [translateTo, setTranslateTo] = useState('English');
  const [hasSelection, setHasSelection] = useState(false);

  const requestRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    const [s, m] = await Promise.all([
      aiApi.status().catch(() => null),
      aiApi.models().catch(() => null),
    ]);
    if (s) setStatus(s);
    if (m) {
      setCatalog(m.catalog);
      setInstalled(m.installed);
      if (Array.isArray(m.ollamaModels)) setOllamaModels(m.ollamaModels);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    setIncludePage(allowPage);
  }, [allowPage]);

  useEffect(() => {
    const offStream = aiApi.onStream((payload) => {
      if (!requestRef.current || payload.requestId !== requestRef.current) return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (!last || last.role !== 'assistant') {
          next.push({ role: 'assistant', content: payload.token });
        } else {
          next[next.length - 1] = { ...last, content: last.content + payload.token };
        }
        return next;
      });
    });
    const offStatus = aiApi.onStatus((next) => setStatus(next));
    const offProgress = aiApi.onModelProgress((p) => {
      // Runtime setup progress is separate from model downloads.
      if (p.kind === 'runtime' || !p.modelId) return;
      const modelId = p.modelId;
      setProgress((prev) => ({ ...prev, [modelId]: p }));
      if (p.done) void refreshStatus();
    });
    return () => {
      offStream();
      offStatus();
      offProgress();
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!activeTab || activeTab.url.startsWith('piflex://')) {
      setHasSelection(false);
      return;
    }
    let cancelled = false;
    void aiApi.selectionText(activeTab.id).then((text) => {
      if (!cancelled) setHasSelection(Boolean(text && text.trim()));
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab?.id, activeTab?.url]);

  const runChat = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) return;
      setError(null);
      setBusy(true);
      const requestId = newRequestId();
      requestRef.current = requestId;
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setInput('');
      try {
        await aiApi.chat({
          requestId,
          tabId: activeTab?.id ?? null,
          history,
          userText: trimmed,
          includePage,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant' && !last.content.trim()) next.pop();
          return next;
        });
      } finally {
        if (requestRef.current === requestId) requestRef.current = null;
        setBusy(false);
      }
    },
    [activeTab?.id, busy, includePage, messages],
  );

  const stop = () => {
    requestRef.current = null;
    aiApi.cancel();
    setBusy(false);
  };

  const extractSelection = async (): Promise<string> => {
    if (!activeTab) return '';
    return aiApi.selectionText(activeTab.id).catch(() => '');
  };

  const quickAction = async (kind: 'summarize' | 'keypoints' | 'explain' | 'translate') => {
    if (kind === 'summarize') return runChat('Summarize the main points of this page in a short, clear paragraph.');
    if (kind === 'keypoints') return runChat('List the key points of this page as a short bullet list.');
    if (kind === 'explain') {
      const selection = await extractSelection();
      if (!selection.trim()) {
        setError('Select some text on the page first, then choose "Explain selection".');
        return;
      }
      return runChat('Explain the following selected text in plain language.');
    }
    if (kind === 'translate') {
      const selection = await extractSelection();
      if (!selection.trim()) {
        setError('Select some text on the page first, then choose "Translate selection".');
        return;
      }
      return runChat(`Translate the following selected text into ${translateTo}. Return only the translation.`);
    }
  };

  const downloadModel = async (modelId: string) => {
    setError(null);
    try {
      await aiApi.downloadModel(modelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectModel = (modelId: string) => {
    void updateSettings({ ai: { modelId } }).then(refreshStatus);
  };

  const removeModel = async (model: AiInstalledModel) => {
    setError('Removing models from the UI is not available yet. Delete the .gguf file from the models folder.');
    void model;
  };

  const pendingDownload = useMemo(
    () => Object.values(progress).find((p) => !p.done && p.total > 0) ?? null,
    [progress],
  );

  const installedIds = useMemo(
    () => new Set(installed.map((m) => m.file.toLowerCase())),
    [installed],
  );

  const pageLabel = activeTab && !activeTab.url.startsWith('piflex://') ? hostOf(activeTab.url) : 'Internal page';

  return (
    <PanelShell
      title="PiFlex Assistant"
      onClose={onClose}
      wide
      headerActions={
        <div className="flex items-center gap-1 rounded-md bg-[var(--color-surface-overlay)] p-0.5">
          <button
            type="button"
            onClick={() => setView('chat')}
            className={cn(
              'rounded px-2 py-1 text-[12px]',
              view === 'chat' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
            )}
          >
            Assistant
          </button>
          <button
            type="button"
            onClick={() => setView('models')}
            className={cn(
              'rounded px-2 py-1 text-[12px]',
              view === 'models' ? 'bg-[var(--color-surface)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)]',
            )}
          >
            Models
          </button>
        </div>
      }
    >
      {view === 'models' ? (
        <ModelsView
          aiEnabled={aiEnabled}
          status={status}
          catalog={catalog}
          installed={installed}
          installedIds={installedIds}
          progress={progress}
          pendingDownload={pendingDownload}
          onToggleEnabled={(enabled) => void updateSettings({ ai: { enabled } }).then(refreshStatus)}
          onSelectProvider={(provider) => void updateSettings({ ai: { provider } }).then(refreshStatus)}
          onDownload={downloadModel}
          onSelect={selectModel}
          onRemove={removeModel}
          selectedModelId={String(aiSettings.modelId ?? '')}
          aiSettings={aiSettings}
          ollamaModels={ollamaModels}
          onGoToSettings={() => {
            useBrowser.getState().setSettingsCategory('ai');
            useBrowser.getState().setPanel('settings');
          }}
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-[var(--color-text-subtle)]" />
                <span className="text-[12px] text-[var(--color-text-muted)]">
                  {status?.ready ? 'Model ready' : aiEnabled ? status?.message || 'Model not loaded' : 'AI disabled'}
                </span>
              </div>
              <StatusDot ok={Boolean(status?.ready)} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--color-border)] px-2.5 py-2">
              <div className="min-w-0">
                <div className="text-[12px] text-[var(--color-text)]">Include page content</div>
                <div className="truncate text-[11px] text-[var(--color-text-subtle)]">
                  {includePage ? pageLabel : 'Only your typed question is sent'}
                </div>
              </div>
              <Switch
                checked={includePage}
                disabled={!aiEnabled}
                onCheckedChange={(checked) => {
                  setIncludePage(checked);
                  void updateSettings({ ai: { allowPageContext: checked } });
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <QuickButton icon={<FileText size={13} />} label="Summarize" onClick={() => void quickAction('summarize')} disabled={!aiEnabled || busy} />
              <QuickButton icon={<ListChecks size={13} />} label="Key points" onClick={() => void quickAction('keypoints')} disabled={!aiEnabled || busy} />
              <QuickButton icon={<HelpCircle size={13} />} label="Explain selection" onClick={() => void quickAction('explain')} disabled={!aiEnabled || busy} />
              <QuickButton icon={<Languages size={13} />} label={`Translate to ${translateTo}`} onClick={() => void quickAction('translate')} disabled={!aiEnabled || busy} />
              <SimpleSelect
                value={translateTo}
                onChange={setTranslateTo}
                options={TRANSLATE_TARGETS}
                className="w-28"
              />
            </div>
            {hasSelection ? (
              <div className="mt-2 text-[11px] text-[var(--color-text-subtle)]">Text is selected on the page.</div>
            ) : null}
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {!aiEnabled ? (
              <EmptyState
                icon={<Sparkles size={20} />}
                title="Local AI is off"
                hint="Enable PiFlex Assistant and install a GGUF model. Everything runs on your device — no cloud service is used."
              />
            ) : messages.length === 0 ? (
              <EmptyState
                icon={<Sparkles size={20} />}
                title="Ask about this page"
                hint="Summarize, explain selected text, translate, or ask a question. Page content is only read when you use an action that needs it."
              />
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'max-w-[92%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                    message.role === 'user'
                      ? 'ml-auto bg-[var(--color-accent-soft)] text-[var(--color-text)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text)]',
                  )}
                >
                  {message.content || (busy ? '…' : '')}
                </div>
              ))
            )}
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--color-border)] p-3">
            <div className="flex items-end gap-2">
              <Input
                value={input}
                placeholder={aiEnabled ? 'Ask about this page…' : 'Enable local AI first'}
                disabled={!aiEnabled}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void runChat(input);
                  }
                }}
              />
              {busy ? (
                <Button variant="secondary" size="icon" aria-label="Stop" onClick={stop}>
                  <Square size={14} />
                </Button>
              ) : (
                <Button size="icon" aria-label="Send" disabled={!aiEnabled || !input.trim()} onClick={() => void runChat(input)}>
                  <Send size={14} />
                </Button>
              )}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
              Runs on your device with the installed model. Page text is treated as untrusted and
              secrets are redacted before inference. Nothing is sent to a remote AI service.
            </p>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full', ok ? 'bg-accent' : 'bg-[var(--color-text-subtle)]')} />
  );
}

function QuickButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled} className="gap-1">
      {icon}
      {label}
    </Button>
  );
}

function ModelsView({
  aiEnabled,
  status,
  catalog,
  installed,
  installedIds,
  progress,
  pendingDownload,
  onToggleEnabled,
  onSelectProvider,
  onDownload,
  onSelect,
  onRemove,
  selectedModelId,
  aiSettings,
  ollamaModels,
  onGoToSettings,
}: {
  aiEnabled: boolean;
  status: AiStatus | null;
  catalog: AiModelInfo[];
  installed: AiInstalledModel[];
  installedIds: Set<string>;
  progress: Record<string, AiModelProgress>;
  pendingDownload: AiModelProgress | null;
  onToggleEnabled: (enabled: boolean) => void;
  onSelectProvider: (provider: string) => void;
  onDownload: (modelId: string) => Promise<void>;
  onSelect: (modelId: string) => void;
  onRemove: (model: AiInstalledModel) => void;
  selectedModelId: string;
  aiSettings: Record<string, unknown>;
  ollamaModels?: string[];
  onGoToSettings: () => void;
}) {
  const provider = status?.provider || 'ollama';
  const isLlama = provider === 'llamacpp';
  const isOllama = provider === 'ollama';

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5">
        <div>
          <div className="text-[13px] text-[var(--color-text)]">Enable local AI</div>
          <div className="text-[11px] text-[var(--color-text-subtle)]">Optional. Browsing works without it.</div>
        </div>
        <Switch checked={aiEnabled} onCheckedChange={onToggleEnabled} />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5">
        <div>
          <div className="text-[13px] text-[var(--color-text)]">Provider</div>
          <div className="text-[11px] text-[var(--color-text-subtle)]">
            {isOllama
              ? 'Ollama daemon (default)'
              : isLlama
                ? 'llama.cpp (local runtime)'
                : 'OpenAI-compatible server'}
          </div>
        </div>
        <SimpleSelect
          value={provider}
          onChange={onSelectProvider}
          options={[
            { value: 'ollama', label: 'Ollama (default)' },
            { value: 'llamacpp', label: 'llama.cpp (local)' },
            { value: 'openai-compatible', label: 'OpenAI-compatible' },
          ]}
          className="w-44"
        />
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[12px] text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2 text-[var(--color-text)] font-medium">
          <Cpu size={14} /> {isOllama ? 'Ollama status' : isLlama ? 'llama.cpp status' : 'AI endpoint status'}
        </div>
        <div className="mt-1">
          {status?.ready ? 'Ready' : status?.message || 'Ready'}
          {isOllama && ` · ${aiSettings.endpoint ? String(aiSettings.endpoint) : 'http://127.0.0.1:11434'}`}
        </div>
        {isOllama ? (
          <div className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-subtle)]">
            Model: <span className="text-[var(--color-text)]">{aiSettings.modelId ? String(aiSettings.modelId) : 'llama3.2 (default)'}</span>
            <br />
            Ensure Ollama is running (`ollama serve`). To install a model, run e.g. `ollama pull llama3.2`.
          </div>
        ) : null}
        {isOllama && ollamaModels && ollamaModels.length > 0 ? (
          <div className="mt-3 space-y-1.5 border-t border-[var(--color-border)] pt-2.5">
            <div className="text-[11px] font-medium text-[var(--color-text)]">Detected in your Ollama:</div>
            <div className="flex flex-wrap gap-1.5">
              {ollamaModels.map((m) => {
                const isActive = (aiSettings.modelId || ollamaModels[0]) === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSelect(m)}
                    className={cn(
                      'flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors',
                      isActive
                        ? 'border-accent bg-accent/15 text-accent font-medium'
                        : 'border-[var(--color-border)] hover:bg-[var(--color-surface-overlay)] text-[var(--color-text)]',
                    )}
                  >
                    {isActive ? <Check size={11} /> : null}
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {status?.enabled ? (
          <button type="button" className="mt-2 text-[11px] text-accent hover:underline" onClick={onGoToSettings}>
            Open AI settings
          </button>
        ) : null}
      </div>

      {isLlama && pendingDownload ? (
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span>Downloading model…</span>
            <span className="tabular-nums text-[var(--color-text-subtle)]">
              {formatMB(pendingDownload.received / (1024 * 1024))} / {formatMB(pendingDownload.total / (1024 * 1024))}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${Math.min(100, (pendingDownload.received / Math.max(1, pendingDownload.total)) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {isLlama ? (
        <>
          <div>
            <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Available models (llama.cpp)
            </h3>
            <div className="space-y-2">
              {catalog.map((model) => {
                const fileName = model.url.split('/').pop()?.toLowerCase() ?? '';
                const isInstalled = installedIds.has(fileName) || status?.installedModels.some((p) => p.toLowerCase().endsWith(fileName));
                const p = progress[model.id];
                const downloading = Boolean(p && !p.done);
                return (
                  <div key={model.id} className="rounded-lg border border-[var(--color-border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[13px] text-[var(--color-text)]">
                          {model.name}
                          {selectedModelId === model.id ? <Check size={13} className="text-accent" /> : null}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--color-text-subtle)]">
                          {model.quant} · {formatMB(model.approxSizeMB)} · {model.license}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                          {model.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {isInstalled ? (
                          <Button size="sm" variant="secondary" onClick={() => onSelect(model.id)}>
                            Use
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => void onDownload(model.id)} disabled={downloading || !aiEnabled}>
                            {downloading ? <Loader2 size={13} className="animate-spin-slow" /> : <Download size={13} />}
                            {downloading ? 'Downloading' : 'Download'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <a
                      href={model.source}
                      onClick={(e) => {
                        e.preventDefault();
                        void piflex.openExternal(model.source);
                      }}
                      className="mt-1 inline-block text-[10px] text-[var(--color-text-subtle)] hover:text-accent"
                    >
                      Source &amp; license
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Installed
            </h3>
            {installed.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 text-[12px] text-[var(--color-text-subtle)]">
                No models installed yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {installed.map((model) => (
                  <div key={model.path} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] text-[var(--color-text)]">{model.file}</div>
                      <div className="text-[11px] text-[var(--color-text-subtle)]">{formatMB(model.sizeBytes / (1024 * 1024))}</div>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove model" onClick={() => onRemove(model)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-[var(--color-text-subtle)]">
            Models are downloaded only when you click Download. The SHA-256 of each finished file is
            computed for verification. Downloads require internet access; inference works offline.
          </p>
        </>
      ) : null}
    </div>
  );
}
