import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, Search, Eye, EyeOff, Trash2, Copy, RefreshCw, ShieldAlert, User } from 'lucide-react';
import { InternalPageLayout, PageEmpty } from '@/components/InternalPageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { credentials as credentialsApi, autofill as autofillApi } from '@/lib/api';
import { cn, hostOf } from '@/lib/utils';
import type { AutofillProfile, CredentialSecret, CredentialSummary } from '@shared/types';

export function PasswordManagerPage() {
  const [vaultAvailable, setVaultAvailable] = useState(true);
  const [items, setItems] = useState<CredentialSummary[]>([]);
  const [profiles, setProfiles] = useState<AutofillProfile[]>([]);
  const [query, setQuery] = useState('');
  const [revealed, setRevealed] = useState<CredentialSecret | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ origin: '', username: '', password: '' });
  const [generated, setGenerated] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    void credentialsApi.vaultAvailable().then(setVaultAvailable).catch(() => setVaultAvailable(false));
    void credentialsApi.list().then(setItems).catch(() => undefined);
    void autofillApi.list().then(setProfiles).catch(() => undefined);
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((c) => c.origin.toLowerCase().includes(q) || c.username.toLowerCase().includes(q));
  }, [items, query]);

  const reveal = async (id: string) => {
    const secret = await credentialsApi.reveal(id).catch(() => null);
    if (secret) setRevealed(secret);
    else setNotice('Could not decrypt this password. The OS keychain may be unavailable.');
  };

  const generate = async () => {
    const password = await credentialsApi.generate({ length: 20 }).catch(() => '');
    setGenerated(password);
    if (password) setDraft((d) => ({ ...d, password }));
  };

  const save = async () => {
    if (!draft.origin.trim() || !draft.username.trim()) return;
    try {
      await credentialsApi.save({
        origin: draft.origin.trim(),
        username: draft.username.trim(),
        password: draft.password,
      });
      setAdding(false);
      setDraft({ origin: '', username: '', password: '' });
      setGenerated('');
      load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save credential');
    }
  };

  return (
    <InternalPageLayout
      page="passwords"
      title="Password Manager"
      subtitle={`${items.length} saved · ${profiles.length} autofill profiles`}
      actions={
        <Button size="sm" onClick={() => setAdding(true)} disabled={!vaultAvailable}>
          <Plus size={13} /> Add password
        </Button>
      }
    >
      <div
        className={cn(
          'mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12px]',
          vaultAvailable
            ? 'border-[var(--color-border)] text-[var(--color-text-subtle)]'
            : 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
        )}
      >
        <ShieldAlert size={15} className="mt-0.5 shrink-0" />
        <span>
          {vaultAvailable
            ? 'Passwords are encrypted with the operating system keychain (Electron safeStorage). PiFlex never syncs them off your device.'
            : 'Secure storage is unavailable on this system, so passwords cannot be saved or read. This is common on Linux without a keyring service.'}
        </span>
      </div>

      {notice ? (
        <div className="mb-4 rounded-md bg-[var(--color-danger-soft)] px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {notice}{' '}
          <button type="button" className="underline" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search passwords" className="pl-8" />
      </div>

      {filtered.length === 0 ? (
        <PageEmpty
          title={items.length === 0 ? 'No saved passwords' : 'No matches'}
          hint={items.length === 0 ? 'Passwords you save will be encrypted and listed here.' : 'Try a different search.'}
        />
      ) : (
        <ul className="space-y-1">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)]"
            >
              <KeyRound size={14} className="shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-[var(--color-text)]">{hostOf(c.origin) || c.origin}</div>
                <div className="truncate text-[11px] text-[var(--color-text-subtle)]">{c.username || 'no username'}</div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="icon-sm" variant="ghost" aria-label="Reveal" onClick={() => void reveal(c.id)}>
                  <Eye size={14} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete"
                  onClick={() => void credentialsApi.remove(c.id).then(load)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          Autofill profiles
        </h2>
        {profiles.length === 0 ? (
          <p className="text-[12px] text-[var(--color-text-subtle)]">
            No autofill profiles yet. Address and payment data you save are encrypted the same way as passwords.
          </p>
        ) : (
          <ul className="space-y-1">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="group flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2"
              >
                <User size={14} className="shrink-0 text-[var(--color-text-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-[var(--color-text)]">{p.name}</div>
                  <div className="truncate text-[11px] text-[var(--color-text-subtle)]">
                    {p.category} · {p.fields.length} fields
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete profile"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => void autofillApi.remove(p.id).then(load)}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reveal dialog */}
      <Dialog open={Boolean(revealed)} onOpenChange={(open) => !open && setRevealed(null)}>
        {revealed ? (
          <DialogContent title={hostOf(revealed.origin) || revealed.origin}>
            <div className="space-y-3">
              <Field label="Username" value={revealed.username} />
              <Field label="Password" value={revealed.password} />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(revealed.password)}
              >
                <Copy size={13} /> Copy password
              </Button>
              <Button onClick={() => setRevealed(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      {/* Add dialog */}
      <Dialog
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) setGenerated('');
        }}
      >
        <DialogContent title="Add password">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">Site</span>
              <Input
                value={draft.origin}
                onChange={(e) => setDraft((d) => ({ ...d, origin: e.target.value }))}
                placeholder="https://example.com"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">Username</span>
              <Input value={draft.username} onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-[var(--color-text-muted)]">Password</span>
              <div className="flex gap-2">
                <Input value={draft.password} onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))} />
                <Button variant="outline" onClick={() => void generate()}>
                  <RefreshCw size={13} /> Generate
                </Button>
              </div>
            </label>
            {generated ? (
              <p className="text-[11px] text-[var(--color-text-subtle)]">Generated a 20-character password.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={!draft.origin.trim() || !draft.username.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </InternalPageLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="mb-1 text-[12px] text-[var(--color-text-muted)]">{label}</div>
      <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[var(--color-text)]">
          {shown ? value : '•'.repeat(Math.min(value.length, 16))}
        </span>
        <button
          type="button"
          aria-label={shown ? 'Hide' : 'Show'}
          className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
          onClick={() => setShown((s) => !s)}
        >
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}
