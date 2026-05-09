import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { CommandContext, CommandModule } from '../commands/index.js';
import type { ModalTrigger } from '../modals/index.js';
import { isTerminalMouseReport } from '../utils/input.js';

const ACCENT_WIDTH = 1;
const INPUT_PADDING_X = 2;
const MIN_INPUT_LINES = 1;
const MAX_VISIBLE_INPUT_LINES = 10;
const MAX_MENU_ITEMS = 10;

interface PromptInputProps {
  onSubmit: (v: string) => void;
  commands: CommandModule[];
  commandContext: CommandContext;
  width: number;
  inputActive?: boolean;
  modalTriggers?: ModalTrigger[];
  onModalTrigger?: (trigger: ModalTrigger) => void;
  placeholder?: string;
  subject?: string;
  subjectColor?: string;
  model?: string;
  reasoningEffort?: string;
  material?: string;
  studyLanguage?: string;
  showContextRow?: boolean;
  onMenuVisibleChange?: (visible: boolean) => void;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  onSubmit,
  commands,
  commandContext,
  width,
  inputActive = true,
  modalTriggers = [],
  onModalTrigger,
  placeholder = 'Ask anything...',
  subject = 'Subject',
  subjectColor = '#3b82f6',
  model = 'Model',
  reasoningEffort = 'Reasoning effort',
  material = 'Material',
  studyLanguage = 'Study Language',
  showContextRow = true,
  onMenuVisibleChange,
}) => {
  const [value, setValue] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [cursorVisible, setCursorVisible] = React.useState(true);
  const [menuDismissed, setMenuDismissed] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => setCursorVisible(visible => !visible), 530);
    return () => clearInterval(id);
  }, []);

  const slashEligible = value.startsWith('/') && !/\s/.test(value);
  const commandQuery = slashEligible ? value.slice(1).toLowerCase() : null;

  React.useEffect(() => {
    setMenuDismissed(false);
  }, [value]);

  const suggestions = React.useMemo(() => {
    if (commandQuery === null) return [];
    const sorted = [...commands].sort((a, b) => a.config.name.localeCompare(b.config.name));
    if (commandQuery === '') return sorted.slice(0, MAX_MENU_ITEMS);

    return sorted
      .map(command => {
        const haystacks = [command.config.name, command.config.description].map(item => item.toLowerCase());
        const starts = haystacks.some(item => item.startsWith(commandQuery));
        const includes = haystacks.some(item => item.includes(commandQuery));

        if (!starts && !includes) return null;

        return {
          command,
          score: starts ? 0 : 1,
        };
      })
      .filter((item): item is { command: CommandModule; score: number } => item !== null)
      .sort((a, b) => a.score - b.score || a.command.config.name.localeCompare(b.command.config.name))
      .slice(0, MAX_MENU_ITEMS)
      .map(item => item.command);
  }, [commandQuery, commands]);
  const menuVisible = slashEligible && !menuDismissed;

  React.useEffect(() => {
    onMenuVisibleChange?.(menuVisible);
  }, [menuVisible, onMenuVisibleChange]);
  const menuItems = menuVisible ? suggestions : [];
  const menuRowCount = Math.max(1, menuItems.length);
  const menuTop = -menuRowCount;
  const menuInnerWidth = Math.max(1, width - 4);
  const commandWidth = Math.max(0, ...commands.map(command => command.config.name.length + 1)) + 2;

  React.useEffect(() => {
    setSelectedIndex(current => {
      if (menuItems.length === 0) return 0;
      return Math.min(current, menuItems.length - 1);
    });
  }, [menuItems]);

  const applySuggestion = React.useCallback((index: number) => {
    const suggestion = menuItems[index];
    if (!suggestion) return;
    setValue(`/${suggestion.config.name} `);
    setSelectedIndex(index);
    setMenuDismissed(true);
  }, [menuItems]);

  const executeCommand = React.useCallback((command: CommandModule) => {
    void command.execute(commandContext);
    setValue('');
    setSelectedIndex(0);
    setMenuDismissed(false);
  }, [commandContext]);

  const matchingModalTrigger = React.useCallback((input: string, key: Parameters<Parameters<typeof useInput>[0]>[1]) => {
    return modalTriggers.find(trigger => {
      if (trigger.tab) return key.tab;
      if (trigger.ctrl) return key.ctrl && input === trigger.input;
      return input === trigger.input;
    });
  }, [modalTriggers]);

  useInput((input, key) => {
    if (isTerminalMouseReport(input)) return;

    if (menuVisible && menuItems.length > 0 && (key.upArrow || (key.ctrl && input === 'p'))) {
      setSelectedIndex(current => (current - 1 + menuItems.length) % menuItems.length);
      return;
    }
    if (menuVisible && menuItems.length > 0 && (key.downArrow || (key.ctrl && input === 'n'))) {
      setSelectedIndex(current => (current + 1) % menuItems.length);
      return;
    }
    if (menuVisible && menuItems.length > 0 && key.tab) {
      applySuggestion(selectedIndex);
      return;
    }
    const modalTrigger = matchingModalTrigger(input, key) ?? (
      key.return && value.length === 0
        ? modalTriggers.find(trigger => trigger.ctrl && trigger.input === 'm')
        : undefined
    );
    if (modalTrigger) {
      onModalTrigger?.(modalTrigger);
      return;
    }
    if (menuVisible && key.escape) {
      setMenuDismissed(true);
      return;
    }
    if (key.return) {
      const trimmed = value.trim();
      if (menuVisible && menuItems.length > 0) {
        const command = menuItems[selectedIndex];
        if (command) executeCommand(command);
        return;
      }
      if (trimmed.startsWith('/')) {
        const name = trimmed.slice(1).split(/\s+/, 1)[0];
        const command = commands.find(item => item.config.name === name);
        if (command) {
          executeCommand(command);
          return;
        }
      }
      if (trimmed) {
        onSubmit(trimmed);
        setValue('');
        setSelectedIndex(0);
        setMenuDismissed(false);
      }
      return;
    }
    if (key.backspace || key.delete) {
      setValue(current => current.slice(0, -1));
      return;
    }
    if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.pageUp || key.pageDown || key.home || key.end) return;
    if (key.ctrl || key.meta || key.escape || key.tab) return;
    setValue(current => current + input);
  }, { isActive: inputActive });

  const isPlaceholder = value.length === 0;
  const contentWidth = Math.max(1, width - ACCENT_WIDTH - INPUT_PADDING_X * 2);

  const wrapLines = React.useCallback((text: string, lineWidth: number) => {
    if (!text) return [''];

    const lines: string[] = [];
    for (let index = 0; index < text.length; index += lineWidth) {
      lines.push(text.slice(index, index + lineWidth));
    }

    return lines.length > 0 ? lines : [''];
  }, []);

  const visibleLines = React.useMemo(() => {
    if (isPlaceholder) return [];

    const lines = wrapLines(value, contentWidth);
    const lastLine = lines[lines.length - 1] ?? '';

    if (value.length > 0 && lastLine.length === contentWidth) {
      lines.push('');
    }

    return lines.slice(-MAX_VISIBLE_INPUT_LINES);
  }, [contentWidth, isPlaceholder, value, wrapLines]);

  const cursor = cursorVisible ? '█' : ' ';
  const placeholderCursor = cursorVisible ? cursor : placeholder[0] ?? ' ';

  const truncate = React.useCallback((text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    if (maxLength <= 1) return '…'.slice(0, maxLength);
    return `${text.slice(0, maxLength - 1)}…`;
  }, []);

  return (
    <Box flexDirection="column" width={width}>
      {menuVisible && (
        <Box
          position="absolute"
          top={menuTop}
          left={0}
          width={width}
          flexDirection="column"
          borderStyle="single"
          borderTop={false}
          borderBottom={false}
          borderColor="#303036"
          backgroundColor="#101014"
          overflow="hidden"
        >
          {menuItems.length === 0 ? (
            <Box paddingX={1} width="100%">
              <Text color="#777777">No matching commands</Text>
            </Box>
          ) : menuItems.map((suggestion, index) => {
            const isSelected = index === selectedIndex;
            const remaining = Math.max(0, menuInnerWidth - commandWidth);
            const description = truncate(suggestion.config.description, remaining);

            return (
              <Box key={suggestion.config.name} paddingX={1} width="100%" backgroundColor={isSelected ? subjectColor : undefined}>
                <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>
                  {`/${suggestion.config.name}`.padEnd(commandWidth)}
                </Text>
                <Text color={isSelected ? '#000000' : '#777777'}>
                  {description}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      <Box
        flexDirection="row"
        width={width}
        backgroundColor="#1f1f23"
      >
        <Box width={ACCENT_WIDTH} backgroundColor={subjectColor} />

        <Box flexDirection="column" flexGrow={1} paddingX={INPUT_PADDING_X} paddingY={1}>
          <Box marginBottom={1} minHeight={MIN_INPUT_LINES} flexDirection="column">
            {isPlaceholder ? (
              <Text>
                <Text color={cursorVisible ? '#f0f0f0' : '#b0b0b6'}>{placeholderCursor}</Text>
                <Text color="#b0b0b6">{placeholder.slice(1)}</Text>
              </Text>
            ) : (
              visibleLines.map((line, index) => {
                const isLastLine = index === visibleLines.length - 1;

                return (
                  <Text key={`${index}:${line}`}>
                    <Text color="#f0f0f0">{line}</Text>
                    {isLastLine && <Text color="#f0f0f0">{cursor}</Text>}
                  </Text>
                );
              })
            )}
          </Box>

          {showContextRow && (
            <Box flexDirection="row">
              <Text color={subjectColor} bold>{subject}</Text>
              <Text color="#3a3a3a"> · </Text>
              <Text color="#888888">{model}</Text>
              <Text color="#3a3a3a"> · </Text>
              <Text color="#f0a500" bold>{reasoningEffort}</Text>
              <Text color="#3a3a3a"> · </Text>
              <Text color="#888888">{material}</Text>
              <Text color="#3a3a3a"> · </Text>
              <Text color="#888888">{studyLanguage}</Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
