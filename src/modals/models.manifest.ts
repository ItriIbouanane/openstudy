import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'models',
  trigger: {
    id: 'models',
    key: 'ctrl+m',
    label: 'model',
    description: 'Open model selector',
    input: 'm',
    ctrl: true,
  },
  load: () => import('./models.js'),
};
