export interface CommandConfig {
  name: string;
  description: string;
}

export interface CommandContext {
  onExit: () => void;
  onSetup: () => void;
  openModal: (id: string, modal?: Record<string, unknown>) => void | Promise<void>;
  closeModal: () => void;
}

export interface CommandModule {
  config: CommandConfig;
  execute: (context: CommandContext) => void | Promise<void>;
}
