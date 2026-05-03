import React from 'react';
import { Box, Text } from 'ink';
import { createProvider, type ProviderReasoningLevel } from '../providers/index.js';
import { focusTextColor } from '../utils/index.js';
import { createHandleInput, isCancel, isSubmit } from './input.js';
import type { ModalContext, ModalInputProps, ModalRenderProps, ModalState } from './types.js';

const REASONING_MODAL_MAX_ROWS = 6;

type ReasoningModalState =
  | { id: 'reasoning'; selected: number; levels: ProviderReasoningLevel[]; model: string; providerLabel: string }
  | { id: 'reasoning'; selected: number; levels: []; error: string };

export function open(context: ModalContext): ModalState {
  const selectedModel = context.selectedModel;

  if (!selectedModel) {
    return { id: 'reasoning', selected: 0, levels: [], error: 'Select a model before choosing reasoning.' };
  }

  const provider = createProvider(selectedModel.provider);
  const modelOption = provider?.GetModels().find(option => option.model === selectedModel.name) ?? null;

  if (!provider || !modelOption) {
    return { id: 'reasoning', selected: 0, levels: [], error: 'Selected model is unavailable.' };
  }

  if (modelOption.reasoningLevels.length === 0) {
    return { id: 'reasoning', selected: 0, levels: [], error: `${modelOption.label} has no reasoning levels.` };
  }

  const selected = Math.max(
    0,
    modelOption.reasoningLevels.findIndex(level => level.value === context.session.reasoningEffort),
  );

  return {
    id: 'reasoning',
    selected,
    levels: modelOption.reasoningLevels,
    model: modelOption.label,
    providerLabel: provider.label,
  };
}

export function getHeight(modal: ModalState) {
  const state = modal as ReasoningModalState;
  const rows = Math.max(1, Math.min(REASONING_MODAL_MAX_ROWS, state.levels.length));
  return rows + 7;
}

export function render({ modal, context }: ModalRenderProps) {
  const state = modal as ReasoningModalState;

  if ('error' in state) {
    return (
      <>
        <Box justifyContent="space-between" marginBottom={1}>
          <Text color="#f0f0f0" bold>Select Reasoning</Text>
          <Text color="#777777">esc</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="#ef4444">{state.error}</Text>
        </Box>
        <Box justifyContent="flex-end">
          <Text color="#777777">enter close</Text>
        </Box>
      </>
    );
  }

  const rows = Math.max(1, Math.min(REASONING_MODAL_MAX_ROWS, state.levels.length));
  const windowStart = Math.min(
    Math.max(0, state.selected - rows + 1),
    Math.max(0, state.levels.length - rows),
  );
  const visibleLevels = state.levels.slice(windowStart, windowStart + rows);
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>{state.providerLabel}/{state.model}</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Select a reasoning level.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {visibleLevels.map((level, index) => {
          const levelIndex = windowStart + index;
          const isSelected = state.selected === levelIndex;
          const isCurrent = context.session.reasoningEffort === level.value;

          return (
            <Box key={level.id} backgroundColor={isSelected ? subjectColor : undefined} justifyContent="space-between">
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{level.label}</Text>
              {isCurrent && <Text color={focusTextColor('#22c55e', subjectColor, isSelected)}>current</Text>}
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color="#777777">↑↓ move {windowStart + 1}-{windowStart + visibleLevels.length}/{state.levels.length}</Text>
        <Text color="#777777">enter select</Text>
      </Box>
    </>
  );
}

export const handleInput = createHandleInput([
  {
    when: isCancel,
    run: ({ context }) => context.closeModal(),
  },
  {
    when: isSubmit,
    run: selectReasoningLevel,
  },
  {
    when: ({ key }) => key.upArrow,
    run: props => moveSelection(props, -1),
  },
  {
    when: ({ key }) => key.downArrow,
    run: props => moveSelection(props, 1),
  },
]);

function selectReasoningLevel({ modal, context }: ModalInputProps) {
  const state = modal as ReasoningModalState;
  if ('error' in state) {
    context.closeModal();
    return;
  }

  const level = state.levels[state.selected];
  if (level) context.updateSettings({ reasoningEffort: level.value });
  context.closeModal();
}

function moveSelection({ modal, context }: ModalInputProps, direction: -1 | 1) {
  const state = modal as ReasoningModalState;
  if ('error' in state || state.levels.length === 0) return;

  context.updateModal({ ...state, selected: (state.selected + direction + state.levels.length) % state.levels.length });
}
