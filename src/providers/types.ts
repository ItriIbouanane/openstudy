export type ProviderPromptFile = string | {
  path: string;
};

export interface ProviderPromptOptions {
  system?: string;
  model?: string;
  threadId?: string;
  workingDirectory?: string;
  signal?: AbortSignal;
  reasoningEffort?: string;
  file?: ProviderPromptFile;
  files?: ProviderPromptFile[];
  responseSchema?: unknown;
}

export interface ProviderPromptStreamEvent {
  type: 'status' | 'response';
  text: string;
}

export interface ProviderReasoningLevel {
  id: string;
  label: string;
  value: string;
}

export interface ProviderModelOption {
  id: string;
  label: string;
  model: string;
  reasoningLevels: ProviderReasoningLevel[];
}

export interface AIProvider {
  id: string;
  label: string;
  CheckLoginStatus(): Promise<boolean>;
  GetModels(): ProviderModelOption[];
  Prompt(input: string, options?: ProviderPromptOptions): AsyncGenerator<ProviderPromptStreamEvent>;
}

export type ProviderConstructor<TProvider extends AIProvider = AIProvider> = new () => TProvider;

export interface ProviderDefinition<TProvider extends AIProvider = AIProvider> {
  id: string;
  label: string;
  requiresKey: boolean;
  Provider: ProviderConstructor<TProvider>;
}
