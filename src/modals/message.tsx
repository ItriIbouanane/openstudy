import React from 'react';
import { Box, Text } from 'ink';
import { createHandleInput, isCancel, isSubmit } from './input.js';
import type { ModalRenderProps, ModalState } from './types.js';

interface MessageModalState extends ModalState {
  id: 'message';
  title: string;
  message: string;
}

export function open(_context: unknown, initialState?: Record<string, unknown>): ModalState {
  return {
    id: 'message',
    title: typeof initialState?.['title'] === 'string' ? initialState['title'] : 'Message',
    message: typeof initialState?.['message'] === 'string' ? initialState['message'] : '',
  };
}

export function getHeight() {
  return 7;
}

export function render({ modal, context }: ModalRenderProps) {
  const state = modal as MessageModalState;

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>{state.title}</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#b0b0b6">{state.message}</Text>
      </Box>
      <Box justifyContent="flex-end">
        <Text color="#000000" backgroundColor={context.selectedSubject?.color ?? '#3b82f6'}>  ok  </Text>
      </Box>
    </>
  );
}

export const handleInput = createHandleInput([
  {
    when: props => isCancel(props) || isSubmit(props),
    run: ({ context }) => context.closeModal(),
  },
]);
