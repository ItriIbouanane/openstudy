import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'message',
  Screen: null,
  load: () => import('./message.js'),
};
