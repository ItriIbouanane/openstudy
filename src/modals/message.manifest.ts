import type { ModalManifest } from './types.js';

export const manifest: ModalManifest = {
  id: 'message',
  load: () => import('./message.js'),
};
