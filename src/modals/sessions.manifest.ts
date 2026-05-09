import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'sessions',
  Screen: null,
  load: () => import('./sessions.js'),
};
