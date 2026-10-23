export interface Wallpaper {
  id: string;
  name: string;
  value: string;
}

/**
 * Built-in new-tab backgrounds. Values are plain CSS gradients so they can be
 * stored in settings without shipping image assets.
 */
export const WALLPAPERS: Wallpaper[] = [
  { id: 'deep-sea', name: 'Deep sea', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'midnight', name: 'Midnight', value: 'linear-gradient(135deg, #1a2a6c 0%, #2a4858 100%)' },
  { id: 'slate', name: 'Slate', value: 'linear-gradient(135deg, #16222a 0%, #3a6073 100%)' },
  { id: 'graphite', name: 'Graphite', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { id: 'aurora', name: 'Aurora', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'sunset', name: 'Sunset', value: 'linear-gradient(135deg, #41295a 0%, #2f0743 100%)' },
];

export const DEFAULT_WALLPAPER =
  WALLPAPERS[0]?.value ?? 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)';
