import type { CommandContext, CommandConfig } from './types.js';

export const config: CommandConfig = {
  name: 'moal',
  description: 'Open a test modal',
};

export function execute(context: CommandContext) {
  context.openModal('message', {
    title: 'Test Modal',
    message: 'This is a test modal opened from /moal. Press esc or enter to close it.',
  });
}
