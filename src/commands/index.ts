import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CommandModule } from './types.js';

export type { CommandConfig, CommandContext, CommandModule } from './types.js';

function isCommandModule(value: unknown): value is CommandModule {
  if (!value || typeof value !== 'object') return false;

  const module = value as Partial<CommandModule>;
  const config = module.config;

  return (
    typeof module.execute === 'function' &&
    !!config &&
    typeof config.name === 'string' &&
    config.name.trim().length > 0 &&
    typeof config.description === 'string'
  );
}

export async function loadCommands(): Promise<CommandModule[]> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const currentExt = extname(currentFile);
  const entries = await readdir(currentDir, { withFileTypes: true });

  const commandFiles = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => extname(name) === currentExt)
    .filter(name => !name.endsWith('.d.ts'))
    .filter(name => !['index', 'types'].includes(basename(name, currentExt)))
    .sort((a, b) => a.localeCompare(b));

  const modules = await Promise.all(
    commandFiles.map(async file => import(pathToFileURL(join(currentDir, file)).href) as Promise<unknown>),
  );

  return modules.filter(isCommandModule).sort((a, b) => a.config.name.localeCompare(b.config.name));
}
