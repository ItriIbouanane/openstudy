import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { CommandContext, CommandModule } from '../commands/index.js';
import { ModalHost, type ActiveModal, type ModalRenderContext, type ModalTrigger } from '../modals/index.js';
import { PromptInput } from './PromptInput.js';
import { isTerminalMouseReport } from '../utils/input.js';

const SIDEBAR_WIDTH = 42;
const WIDE_TERMINAL_BREAKPOINT = 120;
const VERSION = '0.1.0';
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
  commands: CommandModule[];
  commandContext: CommandContext;
  inputActive: boolean;
  modal: ActiveModal | null;
  modalContext: ModalRenderContext;
  modalTriggers: ModalTrigger[];
  onModalTrigger: (trigger: ModalTrigger) => void;
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
  commands,
  commandContext,
  inputActive,
  modal,
  modalContext,
  modalTriggers,
  onModalTrigger,
}) => {
  const [activeModeIndex, setActiveModeIndex] = React.useState(0);
  const sidebarVisible = termWidth > WIDE_TERMINAL_BREAKPOINT;
  const contentWidth = Math.max(1, termWidth - (sidebarVisible ? SIDEBAR_WIDTH : 0) - 4);
  const title = truncate(prompt, 50);
  const ActiveMode = SESSION_MODES[activeModeIndex]?.Component ?? SummaryMode;

  useInput((input, key) => {
    if (isTerminalMouseReport(input)) return;

    if (key.ctrl && input === 'l') {
      setActiveModeIndex(current => (current + 1) % SESSION_MODES.length);
      return;
    }
  }, { isActive: inputActive });

  return (
    <Box flexDirection="row" width={termWidth} height={termHeight} backgroundColor={THEME.background}>
      <Box flexGrow={1} flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={1}>
        <Box flexGrow={1} flexDirection="column" width={contentWidth}>
          <Box height={1} flexShrink={0} />
          <ActiveMode />
          <Box flexGrow={1} />
        </Box>

        <Box flexShrink={0} flexDirection="column" width={contentWidth}>
          <PromptInput
            onSubmit={() => undefined}
            commands={commands}
            commandContext={commandContext}
            width={contentWidth}
            inputActive={inputActive}
            modalTriggers={modalTriggers}
            onModalTrigger={onModalTrigger}
            placeholder="Ask anything..."
            subject={subject}
            subjectColor={subjectColor}
            model={model}
            reasoningEffort={reasoningEffort}
            material={material}
            studyLanguage={studyLanguage}
            showContextRow={false}
          />

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

      {modal && <ModalHost modal={modal} termWidth={termWidth} termHeight={termHeight} context={modalContext} />}
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

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
