import type { CommandContext, CommandConfig } from './types.js';

export const config: CommandConfig = {
  name: 'exit',
  description: 'Exit the cli',
};

export function execute(context: CommandContext) {
  context.onExit();
}
