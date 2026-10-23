import { useEffect, useState } from 'react';
import { ShieldQuestion } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { permissions, win } from '@/lib/api';
import { hostOf } from '@/lib/utils';

interface PendingRequest {
  id: string;
  origin: string;
  permission: string;
  detail?: string;
}

const LABELS: Record<string, string> = {
  media: 'use your camera and microphone',
  geolocation: 'know your location',
  notifications: 'show notifications',
  'clipboard-read': 'read your clipboard',
  'clipboard-sanitized-write': 'write to your clipboard',
  midi: 'use MIDI devices',
  midiSysex: 'use system-exclusive MIDI devices',
  fullscreen: 'enter fullscreen',
};

/**
 * Real permission prompt wired to the main-process PermissionService. Nothing is
 * granted without an explicit user decision.
 */
export function PermissionPrompt() {
  const [queue, setQueue] = useState<PendingRequest[]>([]);
  const current = queue[0] ?? null;

  // Modals render in the shell, beneath native page views. Hide the page while
  // a permission prompt is shown so the dialog is visible and clickable.
  useEffect(() => {
    if (!current) return;
    win.setViewVisible(false);
    return () => win.setViewVisible(true);
  }, [current]);

  useEffect(() => {
    const unsubscribe = permissions.onRequest((req) => {
      setQueue((q) => (q.some((r) => r.id === req.id) ? q : [...q, req]));
    });
    return unsubscribe;
  }, []);

  const respond = (allow: boolean, remember: boolean) => {
    if (!current) return;
    permissions.respond(current.id, allow, remember);
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && respond(false, false)}>
      <DialogContent title="Permission request">
        <div className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-accent">
            <ShieldQuestion size={17} />
          </span>
          <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text)]">{hostOf(current.origin)}</span> wants to{' '}
            {LABELS[current.permission] ?? `use ${current.permission}`}.
            {current.detail ? ` (${current.detail})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => respond(false, false)}>
            Block
          </Button>
          <Button variant="outline" onClick={() => respond(false, true)}>
            Always block
          </Button>
          <Button variant="outline" onClick={() => respond(true, true)}>
            Always allow
          </Button>
          <Button onClick={() => respond(true, false)}>Allow once</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
