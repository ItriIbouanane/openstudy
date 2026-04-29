import React from 'react';
import { Box, Text } from 'ink';
import { subjects } from '../options/index.js';
import { focusTextColor } from '../utils/index.js';
import { createHandleInput, isBackspace, isCancel, isPlainTextInput, isSubmit } from './input.js';
import type { ModalContext, ModalInputProps, ModalRenderProps, ModalState } from './types.js';

const SUBJECT_MODAL_MAX_ROWS = 6;

interface SubjectsModalState extends ModalState {
  id: 'subjects';
  filter: string;
  selected: number;
}

export function open(context: ModalContext): ModalState {
  const selected = Math.max(
    0,
    subjects.findIndex(subject => subject.name === context.selectedSubject?.name),
  );

  return { id: 'subjects', filter: '', selected };
}

export function getHeight(modal: ModalState) {
  const filteredSubjects = getFilteredSubjects(modal as SubjectsModalState);
  const subjectRows = Math.max(1, Math.min(SUBJECT_MODAL_MAX_ROWS, filteredSubjects.length));
  return subjectRows + 7;
}

export function render({ modal, context }: ModalRenderProps) {
  const state = modal as SubjectsModalState;
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';

  const filteredSubjects = getFilteredSubjects(state);
  const subjectRows = Math.max(1, Math.min(SUBJECT_MODAL_MAX_ROWS, filteredSubjects.length));
  const subjectWindowStart = Math.min(
    Math.max(0, state.selected - subjectRows + 1),
    Math.max(0, filteredSubjects.length - subjectRows),
  );
  const visibleSubjects = filteredSubjects.slice(subjectWindowStart, subjectWindowStart + subjectRows);

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Select Subject</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Search </Text>
        <Text color="#f0f0f0">{state.filter}</Text>
        <Text color={subjectColor}>█</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {filteredSubjects.length === 0 ? (
          <Text color="#777777">No results found</Text>
        ) : visibleSubjects.map((subject, index) => {
          const subjectIndex = subjectWindowStart + index;
          const isSelected = state.selected === subjectIndex;

            return (
              <Box key={subject.name} backgroundColor={isSelected ? subjectColor : undefined}>
              <Text color={focusTextColor(subject.color, subjectColor, isSelected)} bold={isSelected}>● </Text>
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{subject.name}</Text>
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color="#777777">↑↓ move {subjectWindowStart + 1}-{subjectWindowStart + visibleSubjects.length}/{filteredSubjects.length}</Text>
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
    run: selectSubject,
  },
  {
    when: ({ key }) => key.upArrow,
    run: props => moveSelection(props, -1),
  },
  {
    when: ({ key }) => key.downArrow,
    run: props => moveSelection(props, 1),
  },
  {
    when: isBackspace,
    run: ({ modal, context }) => {
      const state = modal as SubjectsModalState;
      context.updateModal({ ...state, filter: state.filter.slice(0, -1), selected: 0 });
    },
  },
  {
    when: isPlainTextInput,
    run: ({ input, modal, context }) => {
      const state = modal as SubjectsModalState;
      context.updateModal({ ...state, filter: state.filter + input, selected: 0 });
    },
  },
]);

function selectSubject({ modal, context }: ModalInputProps) {
  const state = modal as SubjectsModalState;
  const filteredSubjects = getFilteredSubjects(state);
  const subject = filteredSubjects[state.selected];
  if (subject) context.updateSettings({ subject: subject.name });
  context.closeModal();
}

function moveSelection({ modal, context }: ModalInputProps, direction: -1 | 1) {
  const state = modal as SubjectsModalState;
  const filteredSubjects = getFilteredSubjects(state);
  const count = Math.max(1, filteredSubjects.length);
  context.updateModal({ ...state, selected: (state.selected + direction + count) % count });
}

function getFilteredSubjects(modal: SubjectsModalState) {
  const filter = modal.filter.trim().toLowerCase();
  if (!filter) return subjects;
  return subjects.filter(subject => subject.name.toLowerCase().includes(filter));
}
