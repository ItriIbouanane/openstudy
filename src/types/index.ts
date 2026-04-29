export type Provider =
  | 'codex'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'ollama';

export interface ProviderMeta {
  id: Provider;
  label: string;
  requiresKey: boolean;
}

export interface Config {
  provider: Provider;
  apiKey: string;
}

export interface SessionSettings {
  provider: Provider | null;
  apiKey: string;
  subject: string;
  modelProvider: Provider | null;
  model: string | null;
  reasoningEffort: string;
  material: string;
  studyLanguage: string;
}

export const PROVIDERS: ProviderMeta[] = [
  { id: 'codex', label: 'Codex', requiresKey: false },
];
