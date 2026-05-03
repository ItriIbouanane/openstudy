import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'devtools',
  Screen: null,
  trigger: {
    id: 'devtools',
    key: 'ctrl+d',
    label: 'dev tools',
    description: 'Open developer tools',
    input: 'd',
    ctrl: true,
  },
  load: () => import('./devtools.js'),
};
