import React from 'react';
import { Box, Text, useInput } from 'ink';
import { isTerminalMouseReport } from '../utils/input.js';

const SIDEBAR_WIDTH = 42;
const WIDE_TERMINAL_BREAKPOINT = 120;
const VERSION = '0.1.0';
const INPUT_PADDING_X = 2;
const MAX_VISIBLE_INPUT_LINES = 5;
const SESSION_MODES = [
  { label: 'Summary', Component: SummaryMode },
  { label: 'Quiz', Component: QuizMode },
  { label: 'FlashCards', Component: FlashCardsMode },
  { label: 'Exercises', Component: ExercisesMode },
  { label: 'AI Teacher', Component: AiTeacherMode },
] as const;

const THEME = {
  primary: '#fab283',
  success: '#7fd88f',
  text: '#eeeeee',
  textMuted: '#808080',
  background: '#0a0a0a',
  backgroundPanel: '#141414',
  backgroundElement: '#1e1e1e',
  border: '#484848',
  borderActive: '#606060',
};

interface SessionScreenProps {
  termWidth: number;
  termHeight: number;
  prompt: string;
  subject: string;
  subjectColor: string;
  provider: string;
  model: string;
  reasoningEffort: string;
  material: string;
  studyLanguage: string;
  cwd: string;
}

export const SessionScreen: React.FC<SessionScreenProps> = ({
  termWidth,
  termHeight,
  prompt,
  subject,
  subjectColor,
  provider,
  model,
  reasoningEffort,
  material,
  studyLanguage,
  cwd,
}) => {
  const [value, setValue] = React.useState('');
  const [cursorVisible, setCursorVisible] = React.useState(true);
  const [activeModeIndex, setActiveModeIndex] = React.useState(0);
  const sidebarVisible = termWidth > WIDE_TERMINAL_BREAKPOINT;
  const contentWidth = Math.max(1, termWidth - (sidebarVisible ? SIDEBAR_WIDTH : 0) - 4);
  const inputContentWidth = Math.max(1, contentWidth - 1 - INPUT_PADDING_X * 2);
  const title = truncate(prompt, 50);
  const ActiveMode = SESSION_MODES[activeModeIndex]?.Component ?? SummaryMode;
  const isPlaceholder = value.length === 0;
  const cursor = cursorVisible ? '█' : ' ';
  const placeholder = 'Ask anything...';
  const placeholderCursor = cursorVisible ? cursor : placeholder[0] ?? ' ';
  const visibleInputLines = React.useMemo(() => {
    if (isPlaceholder) return [];

    const lines = wrapLines(value, inputContentWidth);
    const lastLine = lines[lines.length - 1] ?? '';

    if (value.length > 0 && lastLine.length === inputContentWidth) {
      lines.push('');
    }

    return lines.slice(-MAX_VISIBLE_INPUT_LINES);
  }, [inputContentWidth, isPlaceholder, value]);
  const inputPanelHeight = Math.max(3, visibleInputLines.length + 2);

  React.useEffect(() => {
    const id = setInterval(() => setCursorVisible(visible => !visible), 530);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (isTerminalMouseReport(input)) return;

    if (key.ctrl && input === 'l') {
      setActiveModeIndex(current => (current + 1) % SESSION_MODES.length);
      return;
    }

    if (key.return) {
      const trimmed = value.trim();
      if (trimmed) {
        setValue('');
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue(current => current.slice(0, -1));
      return;
    }

    if (key.ctrl || key.meta || key.escape || key.tab) return;

    setValue(current => current + input);
  });

  return (
    <Box flexDirection="row" width={termWidth} height={termHeight} backgroundColor={THEME.background}>
      <Box flexGrow={1} flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={1}>
        <Box flexGrow={1} flexDirection="column" width={contentWidth}>
          <Box height={1} flexShrink={0} />
          <ActiveMode />
          <Box flexGrow={1} />
        </Box>

        <Box flexShrink={0} flexDirection="column" width={contentWidth}>
          <Box flexDirection="row" minHeight={inputPanelHeight}>
            <Box width={1} minHeight={inputPanelHeight} backgroundColor={subjectColor} />
            <Box flexGrow={1} backgroundColor={THEME.backgroundElement} paddingX={2} paddingY={1}>
              <Box minHeight={1} flexDirection="column">
                {isPlaceholder ? (
                  <Text>
                    <Text color={cursorVisible ? THEME.text : THEME.textMuted}>{placeholderCursor}</Text>
                    <Text color={THEME.textMuted}>{placeholder.slice(1)}</Text>
                  </Text>
                ) : (
                  visibleInputLines.map((line, index) => {
                    const isLastLine = index === visibleInputLines.length - 1;

                    return (
                      <Text key={`${index}:${line}`}>
                        <Text color={THEME.text}>{line}</Text>
                        {isLastLine && <Text color={THEME.text}>{cursor}</Text>}
                      </Text>
                    );
                  })
                )}
              </Box>
            </Box>
          </Box>

          <Box flexDirection="row" justifyContent="space-between">
            <Text color={THEME.textMuted}>{' '}</Text>
            <Text color={THEME.textMuted}>ctrl+c exit</Text>
          </Box>
        </Box>
      </Box>

      {sidebarVisible && (
        <Box width={SIDEBAR_WIDTH} height="100%" flexDirection="column" backgroundColor={THEME.backgroundPanel} paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2}>
          <Box flexGrow={1} flexDirection="column" paddingRight={1}>
            <SidebarSection title="Session">
              <Text color={THEME.text} bold>{title}</Text>
              <Text color={THEME.textMuted}>Local study session</Text>
            </SidebarSection>

            <SidebarSection title="Settings">
              <SidebarRow label="Subject" value={subject} valueColor={subjectColor} />
              <SidebarRow label="Provider" value={provider} />
              <SidebarRow label="Model" value={model} />
              <SidebarRow label="Reasoning" value={reasoningEffort} />
              <SidebarRow label="Material" value={material} />
              <SidebarRow label="Language" value={studyLanguage} />
            </SidebarSection>

            <SidebarSection title="AI Info">
              <SidebarRow label="Tokens" value="0 used" />
              <SidebarRow label="Context" value="0% / 100%" />
            </SidebarSection>

            <SidebarSection title="Mode">
              <Box flexDirection="column">
                {SESSION_MODES.map((mode, index) => {
                  const active = index === activeModeIndex;

                  return (
                    <Box key={mode.label} backgroundColor={active ? subjectColor : undefined} paddingX={1} justifyContent="space-between">
                      <Text color={active ? '#000000' : THEME.textMuted} bold={active}>{mode.label}</Text>
                      {active && <Text color="#000000" bold>active</Text>}
                    </Box>
                  );
                })}
              </Box>
              <Box marginTop={1}>
                <Text color={THEME.textMuted}>ctrl+l next mode</Text>
              </Box>
            </SidebarSection>
          </Box>

          <Box flexShrink={0} flexDirection="column" paddingTop={1}>
            <Text color={THEME.textMuted}>
              <Text color={THEME.success}>•</Text>
              {' dir: '}{cwd}
            </Text>
            <Text color={THEME.textMuted}>OpenStudy {VERSION}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

function SummaryMode() {
  return <ModePlaceholder name="Summary" />;
}

function QuizMode() {
  return <ModePlaceholder name="Quiz" />;
}

function FlashCardsMode() {
  return <ModePlaceholder name="FlashCards" />;
}

function ExercisesMode() {
  return <ModePlaceholder name="Exercises" />;
}

function AiTeacherMode() {
  return <ModePlaceholder name="AI Teacher" />;
}

function ModePlaceholder({ name }: { name: string }) {
  return (
    <Box marginTop={1}>
      <Text color={THEME.textMuted}>{name}</Text>
    </Box>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={THEME.primary} bold>{title}</Text>
      <Box flexDirection="column" marginTop={1}>{children}</Box>
    </Box>
  );
}

function SidebarRow({ label, value, valueColor = THEME.text }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box justifyContent="space-between">
      <Text color={THEME.textMuted}>{label}</Text>
      <Text color={valueColor}>{truncate(value, 22)}</Text>
    </Box>
  );
}

function wrapLines(text: string, lineWidth: number) {
  if (!text) return [''];

  const lines: string[] = [];
  for (let index = 0; index < text.length; index += lineWidth) {
    lines.push(text.slice(index, index + lineWidth));
  }

  return lines.length > 0 ? lines : [''];
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
