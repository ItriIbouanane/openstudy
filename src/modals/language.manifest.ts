import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'language',
  Screen: 'home',
  trigger: {
    id: 'language',
    key: 'ctrl+l',
    label: 'language',
    description: 'Open language selector',
    input: 'l',
    ctrl: true,
  },
  load: () => import('./language.js'),
};
