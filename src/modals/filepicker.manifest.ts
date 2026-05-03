import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'filepicker',
  Screen: 'home',
  trigger: {
    id: 'filepicker',
    key: 'ctrl+f',
    label: 'material',
    description: 'Open material picker',
    input: 'f',
    ctrl: true,
  },
  load: () => import('./filepicker.js'),
};
