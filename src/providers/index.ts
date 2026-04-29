export { CodexProvider, CODEX_LOGIN_REQUIRED_MESSAGE, CODEX_MODEL_OPTIONS, CODEX_MODELS, type CodexPromptOptions } from './codex.js';
export type { AIProvider, ProviderConstructor, ProviderDefinition, ProviderModelOption, ProviderPromptOptions, ProviderPromptResult, ProviderReasoningLevel } from './types.js';

import { CodexProvider } from './codex.js';
import type { AIProvider, ProviderDefinition } from './types.js';

const providerDefinitions = [
  {
    id: 'codex',
    label: 'Codex',
    requiresKey: false,
    Provider: CodexProvider,
  },
] as const satisfies readonly ProviderDefinition[];

export type ProviderId = typeof providerDefinitions[number]['id'];

export const providers = {
  codex: new CodexProvider(),
} as const;

export function getAvailableProviders(): ProviderDefinition[] {
  return providerDefinitions.map(provider => ({ ...provider }));
}

export function getProviderDefinition(id: string): ProviderDefinition | null {
  return providerDefinitions.find(provider => provider.id === id) ?? null;
}

export function createProvider(id: ProviderId): AIProvider;
export function createProvider(id: string): AIProvider | null;
export function createProvider(id: string): AIProvider | null {
  const definition = getProviderDefinition(id);
  return definition ? new definition.Provider() : null;
}
