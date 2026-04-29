import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'reasoning',
  trigger: {
    id: 'reasoning',
    key: 'ctrl+r',
    label: 'reasoning',
    description: 'Open reasoning selector',
    input: 'r',
    ctrl: true,
  },
  load: () => import('./reasoning.js'),
};
