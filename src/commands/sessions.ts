import type { CommandContext, CommandConfig } from './types.js';

export const config: CommandConfig = {
  name: 'sessions',
  description: 'Open saved sessions',
};

export function execute(context: CommandContext) {
  void context.openModal('sessions');
}
