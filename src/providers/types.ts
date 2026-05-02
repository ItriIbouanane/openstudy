export type ProviderPromptFile = string | {
  path: string;
};

export interface ProviderPromptOptions {
  model?: string;
  threadId?: string;
  workingDirectory?: string;
  signal?: AbortSignal;
  file?: ProviderPromptFile;
  files?: ProviderPromptFile[];
  responseSchema?: unknown;
}

export interface ProviderPromptResult {
  text: string;
  threadId: string | null;
  raw: unknown;
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
  login(): Promise<void>;
  CheckAuth(): Promise<boolean>;
  GetModelsList(): string[];
  GetModelOptions(): ProviderModelOption[];
  prompt(input: string, options?: ProviderPromptOptions): Promise<ProviderPromptResult>;
}

export type ProviderConstructor<TProvider extends AIProvider = AIProvider> = new () => TProvider;

export interface ProviderDefinition<TProvider extends AIProvider = AIProvider> {
  id: string;
  label: string;
  requiresKey: boolean;
  Provider: ProviderConstructor<TProvider>;
}
