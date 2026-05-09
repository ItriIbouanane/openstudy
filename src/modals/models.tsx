import React from 'react';
import { Box, Text } from 'ink';
import { createProvider, getAvailableProviders, type ProviderDefinition, type ProviderModelOption } from '../providers/index.js';
import type { Provider } from '../types/index.js';
import { focusTextColor } from '../utils/index.js';
import { createHandleInput, isBackspace, isCancel, isPlainTextInput, isSubmit } from './input.js';
import type { ModalContext, ModalInputProps, ModalRenderContext, ModalRenderProps, ModalState } from './types.js';

const MODEL_MODAL_MAX_ROWS = 6;
const SPINNER_FRAMES = ['|', '/', '-', '\\'];

type ModelProviderDefinition = ProviderDefinition & { id: Provider };
type ProviderAuthStatus = { state: 'checking' } | { state: 'ready' } | { state: 'blocked'; message: string };
type ProviderAuthById = Partial<Record<Provider, ProviderAuthStatus>>;

type ModelsModalState =
  | { id: 'models'; layer: 'providers'; selected: number; auth: ProviderAuthById; authCheckId: string; spinnerFrame: number; error?: string }
  | { id: 'models'; layer: 'subproviders'; provider: Provider; selected: number; auth: ProviderAuthById; authCheckId: string; spinnerFrame: number }
  | { id: 'models'; layer: 'models'; provider: Provider; subProvider: string | null; selected: number; auth: ProviderAuthById; authCheckId: string; spinnerFrame: number }
  | { id: 'models'; layer: 'setup'; provider: Provider; apiKey: string; auth: ProviderAuthById; authCheckId: string; spinnerFrame: number; error?: string };

export function open(context: ModalContext): ModalState {
  const providers = getModelProviders();
  const auth = createCheckingAuth(providers);
  const authCheckId = `${Date.now()}-${Math.random()}`;
  const selected = context.selectedModel
    ? providers.findIndex(provider => provider.id === context.selectedModel?.provider)
    : providers.findIndex(provider => provider.id === context.config?.provider);

  setTimeout(() => startProviderAuthCheck(context, providers, authCheckId), 0);

  return { id: 'models', layer: 'providers', selected: Math.max(0, selected), auth, authCheckId, spinnerFrame: 0 };
}

export function getHeight(modal: ModalState) {
  const state = modal as ModelsModalState;
  if (state.layer === 'providers') return Math.max(1, getModelProviders().length) + 7;
  if (state.layer === 'subproviders') {
    const rows = Math.max(1, Math.min(MODEL_MODAL_MAX_ROWS, getSubProviders(getProviderModelOptions(state.provider)).length));
    return rows + 7;
  }
  if (state.layer === 'models') {
    const rows = Math.max(1, Math.min(MODEL_MODAL_MAX_ROWS, getProviderModelOptions(state.provider, state.subProvider).length));
    return rows + 7;
  }

  return 7;
}

export function render(props: ModalRenderProps) {
  const state = props.modal as ModelsModalState;

  if (state.layer === 'providers') return <ProviderLayer {...props} modal={state} />;
  if (state.layer === 'subproviders') return <SubProvidersLayer {...props} modal={state} />;
  if (state.layer === 'models') return <ModelsLayer {...props} modal={state} />;
  if (state.layer === 'setup') return <SetupLayer {...props} modal={state} />;

  return null;
}

export const handleInput = createHandleInput([
  {
    when: props => isProvidersLayer(props) && isProvidersInput(props),
    run: props => handleProvidersInput(props.key, props.modal as Extract<ModelsModalState, { layer: 'providers' }>, props.context),
  },
  {
    when: props => isSubProvidersLayer(props) && isSubProvidersInput(props),
    run: props => handleSubProvidersInput(props.key, props.modal as Extract<ModelsModalState, { layer: 'subproviders' }>, props.context),
  },
  {
    when: props => isModelsLayer(props) && isModelsInput(props),
    run: props => handleModelsInput(props.key, props.modal as Extract<ModelsModalState, { layer: 'models' }>, props.context),
  },
  {
    when: props => isSetupLayer(props) && isSetupInput(props),
    run: props => handleSetupInput(props.input, props.key, props.modal as Extract<ModelsModalState, { layer: 'setup' }>, props.context),
  },
]);

function ProviderLayer({ modal, context }: ModalRenderProps & { modal: Extract<ModelsModalState, { layer: 'providers' }> }) {
  const providers = getModelProviders();
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Select Provider</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Choose a provider before selecting a model.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {providers.length === 0 ? (
          <Text color="#777777">No providers available</Text>
        ) : providers.map((provider, index) => {
          const isSelected = modal.selected === index;
          const status = getProviderStatus(provider, context, modal.auth);
          const statusLabel = status === 'checking'
            ? SPINNER_FRAMES[modal.spinnerFrame % SPINNER_FRAMES.length]
            : status === 'ready'
              ? '✔'
              : status === 'login'
                ? '✖'
            : status;

          return (
            <Box key={provider.id} backgroundColor={isSelected ? subjectColor : undefined} justifyContent="space-between">
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{provider.label}</Text>
              <Text color={focusTextColor(getProviderStatusColor(status), subjectColor, isSelected)} bold>{statusLabel}</Text>
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color={modal.error ? '#ef4444' : '#777777'}>{modal.error ? truncateError(modal.error) : providers.length === 0 ? 'providers unavailable' : '↑↓ move'}</Text>
        <Text color="#777777">enter continue</Text>
      </Box>
    </>
  );
}

function SubProvidersLayer({ modal, context }: ModalRenderProps & { modal: Extract<ModelsModalState, { layer: 'subproviders' }> }) {
  const subProviders = getSubProviders(getProviderModelOptions(modal.provider));
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';
  const rows = Math.max(1, Math.min(MODEL_MODAL_MAX_ROWS, subProviders.length));
  const windowStart = Math.min(
    Math.max(0, modal.selected - rows + 1),
    Math.max(0, subProviders.length - rows),
  );
  const visibleSubProviders = subProviders.slice(windowStart, windowStart + rows);

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>{getProviderLabel(modal.provider)}</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Select a subprovider.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {visibleSubProviders.length === 0 ? (
          <Text color="#777777">No providers available</Text>
        ) : visibleSubProviders.map((sp, index) => {
          const spIndex = windowStart + index;
          const isSelected = modal.selected === spIndex;
          return (
            <Box key={sp.id} backgroundColor={isSelected ? subjectColor : undefined}>
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{sp.name}</Text>
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color="#777777">← back  ↑↓ move</Text>
        <Text color="#777777">enter continue</Text>
      </Box>
    </>
  );
}

function ModelsLayer({ modal, context }: ModalRenderProps & { modal: Extract<ModelsModalState, { layer: 'models' }> }) {
  const modelOptions = getProviderModelOptions(modal.provider, modal.subProvider);
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';
  const modelRows = Math.max(1, Math.min(MODEL_MODAL_MAX_ROWS, modelOptions.length));
  const modelWindowStart = Math.min(
    Math.max(0, modal.selected - modelRows + 1),
    Math.max(0, modelOptions.length - modelRows),
  );
  const visibleModels = modelOptions.slice(modelWindowStart, modelWindowStart + modelRows);

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>{getProviderLabel(modal.provider)}</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Select a model.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {visibleModels.map((modelOption, index) => {
          const modelIndex = modelWindowStart + index;
          const isSelected = modal.selected === modelIndex;
          const isCurrent = context.selectedModel?.provider === modal.provider
            && context.selectedModel.name === modelOption.model;

          return (
            <Box key={modelOption.id} backgroundColor={isSelected ? subjectColor : undefined} justifyContent="space-between">
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{modelOption.label}</Text>
              {isCurrent && <Text color={focusTextColor('#22c55e', subjectColor, isSelected)}>current</Text>}
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color="#777777">{modal.subProvider ? '← back' : '← providers'} {modelWindowStart + 1}-{modelWindowStart + visibleModels.length}/{modelOptions.length}</Text>
        <Text color="#777777">enter select</Text>
      </Box>
    </>
  );
}

function SetupLayer({ modal, context }: ModalRenderProps & { modal: Extract<ModelsModalState, { layer: 'setup' }> }) {
  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Set Up {getProviderLabel(modal.provider)}</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Enter API key to unlock this provider.</Text>
      </Box>
      <Box backgroundColor="#1f1f23" paddingX={1} marginBottom={1}>
        <Text color={modal.apiKey ? '#f0f0f0' : '#777777'}>{modal.apiKey ? '*'.repeat(modal.apiKey.length) : 'API key'}</Text>
        <Text color={context.selectedSubject?.color ?? '#3b82f6'}>█</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={modal.error ? '#ef4444' : '#777777'}>{modal.error ?? '← providers'}</Text>
        <Text color="#777777">enter save</Text>
      </Box>
    </>
  );
}

function isProvidersLayer({ modal }: ModalInputProps) {
  return (modal as ModelsModalState).layer === 'providers';
}

function isSubProvidersLayer({ modal }: ModalInputProps) {
  return (modal as ModelsModalState).layer === 'subproviders';
}

function isModelsLayer({ modal }: ModalInputProps) {
  return (modal as ModelsModalState).layer === 'models';
}

function isSetupLayer({ modal }: ModalInputProps) {
  return (modal as ModelsModalState).layer === 'setup';
}

function isProvidersInput(props: ModalInputProps) {
  return isCancel(props) || isSubmit(props) || props.key.upArrow || props.key.downArrow;
}

function isSubProvidersInput(props: ModalInputProps) {
  return isCancel(props) || isSubmit(props) || props.key.leftArrow || isBackspace(props) || props.key.upArrow || props.key.downArrow;
}

function isModelsInput(props: ModalInputProps) {
  return isCancel(props) || isSubmit(props) || props.key.leftArrow || isBackspace(props) || props.key.upArrow || props.key.downArrow;
}

function isSetupInput(props: ModalInputProps) {
  return isCancel(props) || isSubmit(props) || props.key.leftArrow || isBackspace(props) || isPlainTextInput(props);
}

function handleProvidersInput(
  key: ModalInputProps['key'],
  state: Extract<ModelsModalState, { layer: 'providers' }>,
  context: ModalRenderContext,
) {
  const providers = getModelProviders();

  if (key.escape) {
    context.closeModal();
    return true;
  }

  if (key.upArrow) {
    if (providers.length === 0) return true;
    context.updateModal({ ...state, selected: (state.selected - 1 + providers.length) % providers.length, error: undefined });
    return true;
  }

  if (key.downArrow) {
    if (providers.length === 0) return true;
    context.updateModal({ ...state, selected: (state.selected + 1) % providers.length, error: undefined });
    return true;
  }

  if (key.return) {
    const provider = providers[state.selected];
    if (!provider) return true;
    const auth = getAuthStatus(state.auth, provider.id);

    if (auth.state === 'checking') {
      context.updateModal({ ...state, error: `Checking ${provider.label} login...` });
      return true;
    }

    if (auth.state === 'blocked') {
      context.updateModal({ ...state, error: auth.message });
      return true;
    }

    if (isProviderUsable(provider, context, state.auth)) {
      openNextForProvider(provider.id, context, state.auth);
      return true;
    }

    if (!provider.requiresKey) {
      context.updateSettings({ provider: provider.id, apiKey: '' });
      openNextForProvider(provider.id, context, state.auth);
      return true;
    }

    context.updateModal({ id: 'models', layer: 'setup', provider: provider.id, apiKey: '', auth: state.auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame });
    return true;
  }

  return false;
}

function handleSubProvidersInput(
  key: ModalInputProps['key'],
  state: Extract<ModelsModalState, { layer: 'subproviders' }>,
  context: ModalRenderContext,
) {
  const subProviders = getSubProviders(getProviderModelOptions(state.provider));
  const providerIndex = Math.max(0, getModelProviders().findIndex(p => p.id === state.provider));

  if (key.escape) {
    context.closeModal();
    return true;
  }

  if (key.leftArrow || key.backspace || key.delete) {
    context.updateModal({ id: 'models', layer: 'providers', selected: providerIndex, auth: state.auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame });
    return true;
  }

  if (key.upArrow) {
    if (subProviders.length === 0) return true;
    context.updateModal({ ...state, selected: (state.selected - 1 + subProviders.length) % subProviders.length });
    return true;
  }

  if (key.downArrow) {
    if (subProviders.length === 0) return true;
    context.updateModal({ ...state, selected: (state.selected + 1) % subProviders.length });
    return true;
  }

  if (key.return) {
    const sp = subProviders[state.selected];
    if (sp) openModelsForProvider(state.provider, sp.id, context, state.auth);
    return true;
  }

  return false;
}

function handleModelsInput(
  key: ModalInputProps['key'],
  state: Extract<ModelsModalState, { layer: 'models' }>,
  context: ModalRenderContext,
) {
  const providerIndex = Math.max(0, getModelProviders().findIndex(provider => provider.id === state.provider));
  const modelOptions = getProviderModelOptions(state.provider, state.subProvider);

  if (key.escape) {
    context.closeModal();
    return true;
  }

  if (key.leftArrow || key.backspace || key.delete) {
    if (state.subProvider !== null) {
      const subProviders = getSubProviders(getProviderModelOptions(state.provider));
      const subProviderIndex = Math.max(0, subProviders.findIndex(sp => sp.id === state.subProvider));
      context.updateModal({ id: 'models', layer: 'subproviders', provider: state.provider, selected: subProviderIndex, auth: state.auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame });
    } else {
      context.updateModal({ id: 'models', layer: 'providers', selected: providerIndex, auth: state.auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame });
    }
    return true;
  }

  if (key.upArrow) {
    if (modelOptions.length === 0) return true;
    context.updateModal({ ...state, selected: (state.selected - 1 + modelOptions.length) % modelOptions.length });
    return true;
  }

  if (key.downArrow) {
    if (modelOptions.length === 0) return true;
    context.updateModal({ ...state, selected: (state.selected + 1) % modelOptions.length });
    return true;
  }

  if (key.return) {
    const modelOption = modelOptions[state.selected];
    if (modelOption) {
      const reasoningEffort = modelOption.reasoningLevels.some(level => level.value === context.session.reasoningEffort)
        ? context.session.reasoningEffort
        : getDefaultReasoningLevel(modelOption)?.value ?? context.session.reasoningEffort;

      context.updateSettings({
        modelProvider: state.provider,
        model: modelOption.model,
        reasoningEffort,
      });
    }
    context.closeModal();
    return true;
  }

  return false;
}

function handleSetupInput(
  input: string,
  key: ModalInputProps['key'],
  state: Extract<ModelsModalState, { layer: 'setup' }>,
  context: ModalRenderContext,
) {
  const providerIndex = Math.max(0, getModelProviders().findIndex(provider => provider.id === state.provider));

  if (key.escape) {
    context.closeModal();
    return true;
  }

  if (key.leftArrow) {
    context.updateModal({ id: 'models', layer: 'providers', selected: providerIndex, auth: state.auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame });
    return true;
  }

  if (key.return) {
    const apiKey = state.apiKey.trim();
    if (!apiKey) {
      context.updateModal({ ...state, error: 'API key is required.' });
      return true;
    }

    context.updateSettings({ provider: state.provider, apiKey });
    openNextForProvider(state.provider, context, state.auth);
    return true;
  }

  if (key.backspace || key.delete) {
    context.updateModal({ ...state, apiKey: state.apiKey.slice(0, -1), error: undefined });
    return true;
  }

  if (!key.ctrl && !key.meta && !key.tab && input) {
    context.updateModal({ ...state, apiKey: state.apiKey + input, error: undefined });
    return true;
  }

  return false;
}

function openModelsForProvider(provider: Provider, subProvider: string | null, context: ModalRenderContext, auth: ProviderAuthById) {
  const currentModels = getProviderModelOptions(provider, subProvider);
  const selected = context.selectedModel?.provider === provider
    ? currentModels.findIndex(modelOption => modelOption.model === context.selectedModel?.name)
    : 0;

  context.updateModal(current => {
    const state = current as ModelsModalState;
    return { id: 'models', layer: 'models', provider, subProvider, selected: Math.max(0, selected), auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame };
  });
}

function openSubProvidersForProvider(provider: Provider, context: ModalRenderContext, auth: ProviderAuthById) {
  const allModels = getProviderModelOptions(provider);
  const subProviders = getSubProviders(allModels);
  let selected = 0;
  if (context.selectedModel?.provider === provider) {
    const currentSubId = allModels.find(m => m.model === context.selectedModel?.name)?.group?.id;
    if (currentSubId) {
      const idx = subProviders.findIndex(sp => sp.id === currentSubId);
      if (idx >= 0) selected = idx;
    }
  }

  context.updateModal(current => {
    const state = current as ModelsModalState;
    return { id: 'models', layer: 'subproviders', provider, selected, auth, authCheckId: state.authCheckId, spinnerFrame: state.spinnerFrame };
  });
}

function openNextForProvider(provider: Provider, context: ModalRenderContext, auth: ProviderAuthById) {
  const subProviders = getSubProviders(getProviderModelOptions(provider));
  if (subProviders.length > 1) {
    openSubProvidersForProvider(provider, context, auth);
  } else {
    openModelsForProvider(provider, null, context, auth);
  }
}

function getModelProviders(): ModelProviderDefinition[] {
  return getAvailableProviders() as ModelProviderDefinition[];
}

function getProviderModelOptions(provider: Provider, subProvider?: string | null): ProviderModelOption[] {
  const instance = createProvider(provider);
  if (!instance) return [];
  const models = instance.GetModels();
  if (!subProvider) return models;
  return models.filter(m => m.group?.id === subProvider);
}

function getSubProviders(models: ProviderModelOption[]): { id: string; name: string }[] {
  const seen = new Set<string>();
  const result: { id: string; name: string }[] = [];
  for (const model of models) {
    if (model.group && !seen.has(model.group.id)) {
      seen.add(model.group.id);
      result.push(model.group);
    }
  }
  return result;
}

function getProviderLabel(provider: Provider): string {
  return getModelProviders().find(item => item.id === provider)?.label ?? provider;
}

async function checkProviderAuth(providers: ModelProviderDefinition[]): Promise<ProviderAuthById> {
  const entries = await Promise.all(providers.map(async provider => {
    const instance = createProvider(provider.id);

    if (!instance) {
      return [provider.id, { state: 'blocked', message: `${provider.label} is unavailable.` }] as const;
    }

    try {
      await instance.CheckLoginStatus();
      return [provider.id, { state: 'ready' }] as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [provider.id, { state: 'blocked', message }] as const;
    }
  }));

  return Object.fromEntries(entries) as ProviderAuthById;
}

function isProviderUsable(provider: ModelProviderDefinition, context: ModalRenderContext, auth: ProviderAuthById): boolean {
  const status = getAuthStatus(auth, provider.id);
  return status.state === 'ready' && (!provider.requiresKey || (context.config?.provider === provider.id && context.config.apiKey.trim().length > 0));
}

function getProviderStatus(provider: ModelProviderDefinition, context: ModalRenderContext, auth: ProviderAuthById): 'checking' | 'ready' | 'setup' | 'login' {
  const status = getAuthStatus(auth, provider.id);
  if (status.state === 'checking') return 'checking';
  if (status.state === 'blocked') return 'login';
  return isProviderUsable(provider, context, auth) ? 'ready' : 'setup';
}

function getAuthStatus(auth: ProviderAuthById, provider: Provider): ProviderAuthStatus {
  return auth[provider] ?? { state: 'checking' };
}

function getProviderStatusColor(status: 'checking' | 'ready' | 'setup' | 'login') {
  if (status === 'ready') return '#22c55e';
  if (status === 'login') return '#ef4444';
  return '#f0a500';
}

function createCheckingAuth(providers: ModelProviderDefinition[]): ProviderAuthById {
  return Object.fromEntries(providers.map(provider => [provider.id, { state: 'checking' }])) as ProviderAuthById;
}

function startProviderAuthCheck(context: ModalContext, providers: ModelProviderDefinition[], authCheckId: string) {
  let spinnerFrame = 0;
  const interval = setInterval(() => {
    spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
    context.updateModal(current => updateMatchingAuthState(current, authCheckId, { spinnerFrame }));
  }, 120);

  void checkProviderAuth(providers).then(auth => {
    clearInterval(interval);
    context.updateModal(current => updateMatchingAuthState(current, authCheckId, { auth, spinnerFrame, error: undefined }));
  }).catch(error => {
    clearInterval(interval);
    const message = error instanceof Error ? error.message : String(error);
    const auth = Object.fromEntries(providers.map(provider => [provider.id, { state: 'blocked', message }])) as ProviderAuthById;
    context.updateModal(current => updateMatchingAuthState(current, authCheckId, { auth, spinnerFrame }));
  });
}

function updateMatchingAuthState(current: ModalState, authCheckId: string, patch: Partial<Extract<ModelsModalState, { layer: 'providers' }>>): ModalState {
  const state = current as Partial<ModelsModalState>;
  if (state.id !== 'models' || state.authCheckId !== authCheckId) return current;

  return { ...current, ...patch };
}

function truncateError(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 54 ? `${normalized.slice(0, 53)}…` : normalized;
}

function getDefaultReasoningLevel(modelOption: ProviderModelOption) {
  return modelOption.reasoningLevels.find(level => level.value === 'medium') ?? modelOption.reasoningLevels[0] ?? null;
}
