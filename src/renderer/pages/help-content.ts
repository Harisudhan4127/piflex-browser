export interface HelpBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  blocks: HelpBlock[];
}

/**
 * In-app help content. These pages describe how PiFlex Browser works and are
 * written to be readable both by people and as context the local assistant can
 * reference. They intentionally avoid marketing claims that the code cannot
 * back up.
 */
export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'description',
    title: 'What PiFlex Browser is',
    summary:
      'A lightweight, privacy-focused desktop browser built on Chromium (via Electron) with PiFlex-owned chrome.',
    blocks: [
      {
        paragraphs: [
          'PiFlex Browser is a desktop web browser for Windows, Linux and macOS. It uses the Chromium engine through Electron to render websites, and a custom React interface for the tab strip, toolbar, address bar and internal pages.',
          'Its purpose is to make everyday browsing fast and private without a cloud account. Ad and tracker requests are filtered at the network level, browsing data stays on your device, and an optional on-device AI assistant can summarize pages without sending content to a remote service.',
        ],
      },
      {
        heading: 'Why it matters',
        bullets: [
          'You can browse normally with no sign-in, no sync backend and no telemetry.',
          'Privacy protections are on by default and easy to inspect.',
          'The interface stays lightweight: tabs are native views, and the browser chrome is a single renderer.',
          'Local AI is optional and never required for browsing.',
        ],
      },
    ],
  },
  {
    id: 'settings',
    title: 'Opening and using Settings',
    summary: 'Settings are a real internal page at piflex://settings, grouped by category.',
    blocks: [
      {
        paragraphs: [
          'Open Settings from the main menu (the three-dot button), with the keyboard shortcut Ctrl/Cmd + Comma, or by typing piflex://settings in the address bar.',
          'Settings are saved to disk immediately and restored on the next launch. If a stored value is invalid or from an older version, PiFlex falls back to a safe default instead of failing to start.',
        ],
      },
      {
        heading: 'Categories',
        bullets: [
          'General: startup behavior and default browsing options.',
          'Appearance: theme, compact toolbar, bookmarks bar and home button.',
          'Search: default engine and suggestion behavior.',
          'Privacy and security: ad/tracker blocking, filter lists, Do Not Track and clear-data tools.',
          'Tabs: maximum tabs and inactive-tab suspension.',
          'Downloads: destination folder and safety warnings.',
          'Autofill: passwords, addresses and payment profiles.',
          'Accessibility: reduced motion, larger controls and high contrast.',
          'Extensions: enable or disable installed extensions.',
          'Advanced: hardware acceleration, cache size and logging.',
        ],
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and security',
    summary:
      'Network-level blocking, private windows, permission prompts and on-device storage — with honest limits.',
    blocks: [
      {
        heading: 'Ad and tracker blocking',
        paragraphs: [
          'PiFlex compiles community filter lists (EasyList- and EasyPrivacy-compatible) in the main process. Matching requests are cancelled before they leave the browser. You can see how many requests were blocked, choose filter lists, and turn protection off per site from the shield panel.',
          'This is network-level filtering. It does not rewrite page layout, and it does not claim fingerprinting resistance beyond what Chromium provides.',
        ],
      },
      {
        heading: 'Cookies, site data and permissions',
        bullets: [
          'Camera, microphone, location and notification requests ask for your permission and remember your decision per site.',
          'Clear data removes history, downloads, cookies, cache and saved credentials on demand.',
          'Private windows use a separate session and do not write normal history.',
        ],
      },
      {
        heading: 'Certificates and transport',
        paragraphs: [
          'PiFlex never disables certificate validation and never installs a root certificate. The address bar shows whether the current connection is HTTPS, insecure HTTP, a local file or an internal page.',
          'Downloads with dangerous executable types are flagged and are never opened automatically.',
        ],
      },
      {
        heading: 'What PiFlex does not do',
        bullets: [
          'No cloud sync, no account system and no analytics.',
          'No man-in-the-middle proxying of encrypted traffic.',
          'No claim of full fingerprinting protection.',
        ],
      },
    ],
  },
  {
    id: 'functions',
    title: 'Major functions',
    summary: 'Browsing, tabs, bookmarks, history, downloads, passwords, extensions and the assistant.',
    blocks: [
      {
        heading: 'Navigation and tabs',
        bullets: [
          'Address bar accepts URLs, search terms and piflex:// internal routes.',
          'Back, forward, reload, stop and home with live enabled states.',
          'Create, close, duplicate, pin, mute, group and reorder tabs; open private tabs.',
        ],
      },
      {
        heading: 'Organizing the web',
        bullets: [
          'Bookmarks with folders, search and JSON import/export.',
          'History with search, day grouping, range deletion and export.',
          'Downloads with pause, resume, cancel, retry and safe filenames.',
        ],
      },
      {
        heading: 'Security and identity',
        bullets: [
          'Password vault encrypted with the operating system keychain via Electron safeStorage.',
          'Autofill profiles for identities, addresses and payment fields.',
          'Extension support through Electron’s Chromium extension runtime (a subset).',
        ],
      },
      {
        heading: 'Local assistant',
        paragraphs: [
          'When enabled, the PiFlex Assistant can summarize the current page, explain selected text, list key points, translate text and answer questions about page content. It runs against a GGUF model you install and never contacts a remote AI service.',
        ],
      },
    ],
  },
  {
    id: 'requirements',
    title: 'Basic requirements',
    summary: 'What you need to install and run PiFlex Browser, and what each feature needs.',
    blocks: [
      {
        heading: 'To run the browser',
        bullets: [
          'Windows 10/11, a modern Linux desktop, or macOS 12+.',
          'A 64-bit x86-64 or ARM64 processor.',
          'Roughly 500 MB of disk space for the application and typical browser cache.',
          'At least 4 GB of system RAM for comfortable multi-tab browsing.',
          'An internet connection for web browsing.',
        ],
      },
      {
        heading: 'To build from source',
        bullets: [
          'Node.js 18 or newer and npm.',
          'Desktop C++ build tools only if your platform has no prebuilt better-sqlite3 binary.',
        ],
      },
      {
        heading: 'To use local AI (optional)',
        bullets: [
          'A GGUF model file that you download explicitly (smallest is about 400 MB).',
          'The llama.cpp llama-server runtime in the PiFlex runtime folder, or an Ollama endpoint.',
          'Enough free memory for the model and its context window; PiFlex estimates this before loading and refuses to start if it will not fit.',
        ],
      },
      {
        heading: 'Platforms not supported',
        paragraphs: [
          'Android is not supported. Electron cannot run as an Android application, and PiFlex does not ship a separate Android engine. iOS is also unsupported.',
        ],
      },
    ],
  },
  {
    id: 'advantages',
    title: 'Advantages',
    summary: 'Where PiFlex is strong, and where it is deliberately modest.',
    blocks: [
      {
        bullets: [
          'Privacy by default: network-level ad and tracker blocking with no account required.',
          'On-device AI: page summaries and explanations without sending content to a cloud provider.',
          'Low overhead for its engine: native tab views and a single lightweight shell instead of many duplicated renderers.',
          'Clear security posture: no certificate bypass, sandboxed web content, allow-listed IPC.',
          'Honest scope: features that cannot be delivered are documented instead of faked.',
          'Familiar, fast interface with themes, shortcuts and accessible controls.',
        ],
      },
      {
        heading: 'Trade-offs',
        paragraphs: [
          'Because PiFlex uses Electron, its baseline memory is higher than a natively packaged Chromium or WebKit browser. Extension compatibility is a subset of Chromium, and there is no sync or cloud service. These are documented limits, not hidden behavior.',
        ],
      },
    ],
  },
  {
    id: 'conclusion',
    title: 'Conclusion',
    summary: 'A practical, private desktop browser with optional local AI.',
    blocks: [
      {
        paragraphs: [
          'PiFlex Browser exists to make private, account-free browsing practical on ordinary desktop hardware. It combines the Chromium engine with a purpose-built interface, network-level ad and tracker blocking, encrypted local storage, and an optional assistant that runs entirely on your device.',
          'It is honest about its boundaries: no Android build, no cloud sync, a subset of extensions, and performance that depends on the underlying engine. Within those boundaries, PiFlex aims to be fast, understandable and trustworthy — the kind of browser you can inspect and improve.',
        ],
      },
    ],
  },
];

export function findHelpTopic(id: string | null | undefined): HelpTopic | undefined {
  if (!id) return undefined;
  return HELP_TOPICS.find((topic) => topic.id === id);
}
