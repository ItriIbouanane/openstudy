import fs from 'fs';
import { fileURLToPath } from 'url';
import type { ModalManifest, ModalModule } from './types.js';

const MANIFEST_PATTERN = /\.manifest\.(?:js|ts|tsx)$/;

let manifestPromise: Promise<ModalManifest[]> | null = null;
const moduleCache = new Map<string, Promise<ModalModule>>();

export async function loadModalManifests(): Promise<ModalManifest[]> {
  manifestPromise ??= loadManifests();
  return manifestPromise;
}

export async function loadModalModule(id: string): Promise<ModalModule | null> {
  const manifests = await loadModalManifests();
  const manifest = manifests.find(item => item.id === id);
  if (!manifest) return null;

  let pending = moduleCache.get(id);
  if (!pending) {
    pending = manifest.load();
    moduleCache.set(id, pending);
  }

  return pending;
}

async function loadManifests(): Promise<ModalManifest[]> {
  const directory = fileURLToPath(new URL('.', import.meta.url));
  const entries = fs.readdirSync(directory)
    .filter(entry => MANIFEST_PATTERN.test(entry) && !entry.endsWith('.d.ts'))
    .sort();

  const manifests = await Promise.all(entries.map(async entry => {
    const module = await import(new URL(entry, import.meta.url).href) as {
      manifest?: ModalManifest;
      default?: ModalManifest;
    };

    return module.manifest ?? module.default ?? null;
  }));

  return manifests.filter((manifest): manifest is ModalManifest => manifest !== null);
}
