import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'subjects',
  Screen: 'home',
  trigger: {
    id: 'subjects',
    key: 'tab',
    label: 'subject',
    description: 'Open subject selector',
    tab: true,
  },
  load: () => import('./subjects.js'),
};
