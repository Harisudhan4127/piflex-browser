import { useEffect } from 'react';
import { useBrowser } from '@/store/browser-store';
import { DownloadsPanel } from './DownloadsPanel';
import { PrivacyPanel } from './PrivacyPanel';
import { ExtensionsPanel } from './ExtensionsPanel';
import { AiPanel } from './AiPanel';

/**
 * Overlay panels docked to the right of the browser shell. Full-page surfaces
 * (settings, password manager, about) are opened as real internal tabs instead.
 */
export function OverlayPanel() {
  const { panel, setPanel, createTab } = useBrowser();

  useEffect(() => {
    if (panel === 'passwords') void createTab('piflex://passwords').then(() => setPanel('none'));
    else if (panel === 'settings') void createTab('piflex://settings').then(() => setPanel('none'));
    else if (panel === 'about') void createTab('piflex://about').then(() => setPanel('none'));
    else if (panel === 'bookmarks') void createTab('piflex://bookmarks').then(() => setPanel('none'));
    else if (panel === 'history') void createTab('piflex://history').then(() => setPanel('none'));
    else if (panel === 'downloads') void 0;
  }, [panel, createTab, setPanel]);

  const close = () => setPanel('none');

  switch (panel) {
    case 'downloads':
      return <DownloadsPanel onClose={close} />;
    case 'privacy':
      return <PrivacyPanel onClose={close} />;
    case 'extensions':
      return <ExtensionsPanel onClose={close} />;
    case 'ai':
      return <AiPanel onClose={close} />;
    default:
      return null;
  }
}
