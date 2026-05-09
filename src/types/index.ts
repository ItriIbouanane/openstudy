export type Provider =
  | 'codex'
  | 'opencode'
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
  sessionId: string | null;
  title: string | null;
  summaryText: string | null;
  createdDate: string | null;
  lastOpenedDate: string | null;
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
  { id: 'opencode', label: 'OpenCode', requiresKey: false },
];
