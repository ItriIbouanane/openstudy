import type { CommandContext, CommandConfig } from './types.js';

export const config: CommandConfig = {
  name: 'setup',
  description: 'Start the setup process',
};

export function execute(context: CommandContext) {
  context.onSetup();
}
