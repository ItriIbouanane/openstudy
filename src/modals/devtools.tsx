import fs from 'fs';
import React from 'react';
import { Box, Text } from 'ink';
import { CONFIG_DIR } from '../utils/config.js';
import { getSessionById } from '../utils/index.js';
import { createHandleInput, isBackspace, isCancel, isPlainTextInput, isSubmit } from './input.js';
import type { ModalContext, ModalInputProps, ModalRenderProps, ModalState } from './types.js';

const DEVTOOLS_MAX_ROWS = 10;

const OPTIONS = [
  { id: 'session', label: 'Dump session object', description: 'Show current persisted session state', disabled: false },
  { id: 'erase', label: 'Erase .openstudy directory', description: 'DANGEROUS: reset all OpenStudy state', disabled: false },
  { id: 'more', label: 'More tools soon', description: 'Placeholder for future dev tools', disabled: true },
] as const;

type DevtoolsModalState =
  | { id: 'devtools'; layer: 'options'; selected: number }
  | { id: 'devtools'; layer: 'session'; scroll: number; lines: string[] }
  | { id: 'devtools'; layer: 'erase'; confirmation: string; error?: string }
  | { id: 'devtools'; layer: 'result'; title: string; message: string };

export function open(_context: ModalContext): ModalState {
  return { id: 'devtools', layer: 'options', selected: 0 };
}

export function getHeight(modal: ModalState) {
  const state = modal as DevtoolsModalState;
  if (state.layer === 'session') {
    return Math.max(1, Math.min(DEVTOOLS_MAX_ROWS, state.lines.length)) + 7;
  }

  return OPTIONS.length + 7;
}

export function render(props: ModalRenderProps) {
  const state = props.modal as DevtoolsModalState;

  if (state.layer === 'session') return <SessionDumpLayer {...props} modal={state} />;
  if (state.layer === 'erase') return <EraseLayer modal={state} />;
  if (state.layer === 'result') return <ResultLayer modal={state} />;
  return <OptionsLayer {...props} modal={state} />;
}

export const handleInput = createHandleInput([
  {
    when: props => isOptionsLayer(props) && isOptionsInput(props),
    run: props => handleOptionsInput(props.key, props.modal as Extract<DevtoolsModalState, { layer: 'options' }>, props.context),
  },
  {
    when: props => isSessionLayer(props) && isSessionInput(props),
    run: props => handleSessionInput(props.key, props.modal as Extract<DevtoolsModalState, { layer: 'session' }>, props.context),
  },
  {
    when: props => isEraseLayer(props) && isEraseInput(props),
    run: props => handleEraseInput(props.input, props.key, props.modal as Extract<DevtoolsModalState, { layer: 'erase' }>, props.context),
  },
  {
    when: props => isResultLayer(props) && (isCancel(props) || isSubmit(props)),
    run: ({ context }) => context.closeModal(),
  },
]);

function OptionsLayer({ modal, context }: ModalRenderProps & { modal: Extract<DevtoolsModalState, { layer: 'options' }> }) {
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Dev Tools</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Choose a diagnostic action.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {OPTIONS.map((option, index) => {
          const isSelected = modal.selected === index;

          return (
            <Box key={option.id} backgroundColor={isSelected ? subjectColor : undefined} justifyContent="space-between">
              <Text color={isSelected ? '#000000' : option.disabled ? '#777777' : '#f0f0f0'} bold={isSelected}>{option.label}</Text>
              <Text color={isSelected ? '#000000' : '#777777'}>{option.description}</Text>
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color="#777777">↑↓ move</Text>
        <Text color="#777777">enter open</Text>
      </Box>
    </>
  );
}

function EraseLayer({ modal }: { modal: Extract<DevtoolsModalState, { layer: 'erase' }> }) {
  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#ef4444" bold>Dangerous Action</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1} flexDirection="column">
        <Text color="#f0f0f0">This will permanently delete:</Text>
        <Text color="#ef4444">{CONFIG_DIR}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Type </Text>
        <Text color="#f0a500" bold>ERASE</Text>
        <Text color="#777777"> to confirm.</Text>
      </Box>
      <Box backgroundColor="#1f1f23" paddingX={1} marginBottom={1}>
        <Text color={modal.confirmation ? '#f0f0f0' : '#777777'}>{modal.confirmation || 'ERASE'}</Text>
        <Text color="#ef4444">█</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color={modal.error ? '#ef4444' : '#777777'}>{modal.error ?? '← tools'}</Text>
        <Text color="#777777">enter confirm</Text>
      </Box>
    </>
  );
}

function ResultLayer({ modal }: { modal: Extract<DevtoolsModalState, { layer: 'result' }> }) {
  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>{modal.title}</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#b0b0b6">{modal.message}</Text>
      </Box>
      <Box justifyContent="flex-end">
        <Text color="#777777">enter close</Text>
      </Box>
    </>
  );
}

function SessionDumpLayer({ modal }: ModalRenderProps & { modal: Extract<DevtoolsModalState, { layer: 'session' }> }) {
  const rows = Math.max(1, Math.min(DEVTOOLS_MAX_ROWS, modal.lines.length));
  const maxScroll = Math.max(0, modal.lines.length - rows);
  const scroll = Math.min(modal.scroll, maxScroll);
  const visibleLines = modal.lines.slice(scroll, scroll + rows);

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Session Dump</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Current session object.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {visibleLines.map((line, index) => (
          <Text key={`${scroll + index}:${line}`} color="#d4d4d8">{line}</Text>
        ))}
      </Box>
      <Box justifyContent="space-between">
        <Text color="#777777">← tools {scroll + 1}-{scroll + visibleLines.length}/{modal.lines.length}</Text>
        <Text color="#777777">↑↓ scroll</Text>
      </Box>
    </>
  );
}

function isOptionsLayer({ modal }: ModalInputProps) {
  return (modal as DevtoolsModalState).layer === 'options';
}

function isSessionLayer({ modal }: ModalInputProps) {
  return (modal as DevtoolsModalState).layer === 'session';
}

function isEraseLayer({ modal }: ModalInputProps) {
  return (modal as DevtoolsModalState).layer === 'erase';
}

function isResultLayer({ modal }: ModalInputProps) {
  return (modal as DevtoolsModalState).layer === 'result';
}

function isOptionsInput(props: ModalInputProps) {
  return isCancel(props) || isSubmit(props) || props.key.upArrow || props.key.downArrow;
}

function isSessionInput(props: ModalInputProps) {
  return isCancel(props) || props.key.leftArrow || isBackspace(props) || props.key.upArrow || props.key.downArrow;
}

function isEraseInput(props: ModalInputProps) {
  return isCancel(props) || isSubmit(props) || props.key.leftArrow || isBackspace(props) || isPlainTextInput(props);
}

function handleOptionsInput(
  key: ModalInputProps['key'],
  state: Extract<DevtoolsModalState, { layer: 'options' }>,
  context: ModalContext,
) {
  if (key.escape) {
    context.closeModal();
    return;
  }

  if (key.upArrow) {
    context.updateModal({ ...state, selected: (state.selected - 1 + OPTIONS.length) % OPTIONS.length });
    return;
  }

  if (key.downArrow) {
    context.updateModal({ ...state, selected: (state.selected + 1) % OPTIONS.length });
    return;
  }

  if (key.return) {
    const option = OPTIONS[state.selected];
    if (!option || option.disabled) return;

    if (option.id === 'session') {
      const session = context.activeSessionId ? getSessionById(context.activeSessionId) ?? context.session : context.session;
      context.updateModal({ id: 'devtools', layer: 'session', scroll: 0, lines: JSON.stringify(session, null, 2).split('\n') });
    }

    if (option.id === 'erase') {
      context.updateModal({ id: 'devtools', layer: 'erase', confirmation: '' });
    }
  }
}

function handleSessionInput(
  key: ModalInputProps['key'],
  state: Extract<DevtoolsModalState, { layer: 'session' }>,
  context: ModalContext,
) {
  const rows = Math.max(1, Math.min(DEVTOOLS_MAX_ROWS, state.lines.length));
  const maxScroll = Math.max(0, state.lines.length - rows);

  if (key.escape) {
    context.closeModal();
    return;
  }

  if (key.leftArrow || key.backspace || key.delete) {
    context.updateModal({ id: 'devtools', layer: 'options', selected: 0 });
    return;
  }

  if (key.upArrow) {
    context.updateModal({ ...state, scroll: Math.max(0, state.scroll - 1) });
    return;
  }

  if (key.downArrow) {
    context.updateModal({ ...state, scroll: Math.min(maxScroll, state.scroll + 1) });
  }
}

function handleEraseInput(
  input: string,
  key: ModalInputProps['key'],
  state: Extract<DevtoolsModalState, { layer: 'erase' }>,
  context: ModalContext,
) {
  if (key.escape) {
    context.closeModal();
    return;
  }

  if (key.leftArrow) {
    context.updateModal({ id: 'devtools', layer: 'options', selected: 1 });
    return;
  }

  if (key.return) {
    if (state.confirmation !== 'ERASE') {
      context.updateModal({ ...state, error: 'Confirmation must exactly match ERASE.' });
      return;
    }

    try {
      fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
      context.updateModal({
        id: 'devtools',
        layer: 'result',
        title: 'OpenStudy State Erased',
        message: 'Deleted .openstudy. Restart OpenStudy to reload clean state.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.updateModal({ ...state, error: message });
    }
    return;
  }

  if (key.backspace || key.delete) {
    context.updateModal({ ...state, confirmation: state.confirmation.slice(0, -1), error: undefined });
    return;
  }

  if (!key.ctrl && !key.meta && !key.tab && input) {
    context.updateModal({ ...state, confirmation: state.confirmation + input, error: undefined });
  }
}
