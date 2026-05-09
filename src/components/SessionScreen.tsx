import fs from 'fs';
import path from 'path';
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { lexer, type Token, type Tokens } from 'marked';
import type { CommandContext, CommandModule } from '../commands/index.js';
import { ModalHost, type ActiveModal, type ModalRenderContext, type ModalTrigger } from '../modals/index.js';
import { createProvider } from '../providers/index.js';
import { summarySystemPrompt } from '../prompts/summary.js';
import { PromptInput } from './PromptInput.js';
import type { Provider } from '../types/index.js';
import { getSessionById, saveSessionById } from '../utils/index.js';
import { isTerminalMouseReport, parseMouseWheelScroll } from '../utils/input.js';

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
const SUMMARY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    SessionTitle: { type: 'string' },
    content: { type: 'string' },
  },
  required: ['SessionTitle', 'content'],
  additionalProperties: false,
} as const;
const SUMMARY_LOADING_STEPS = [
  'Checking session inputs',
  'Resolving material path',
  'Preparing request',
  'Checking login',
  'Starting session',
  'Waiting for structured response',
  'Waiting for response',
  'Analyzing key ideas',
] as const;

type SummaryState =
  | { status: 'loading'; step: string }
  | { status: 'streaming'; response: string }
  | { status: 'ready'; response: string }
  | { status: 'error'; error: string };

type SummaryLine = {
  text: string;
  color: string;
  bold?: boolean;
  dim?: boolean;
};

interface SessionScreenProps {
  termWidth: number;
  termHeight: number;
  sessionId: string | null;
  prompt: string;
  subject: string;
  subjectColor: string;
  modelProvider: Provider | null;
  provider: string;
  model: string;
  reasoningEffort: string;
  material: string;
  materialPath: string;
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
  sessionId,
  prompt,
  subject,
  subjectColor,
  modelProvider,
  provider,
  model,
  reasoningEffort,
  material,
  materialPath,
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
  const [commandMenuActive, setCommandMenuActive] = React.useState(false);
  const [summaryState, setSummaryState] = React.useState<SummaryState>(() => {
    const storedSession = sessionId ? getSessionById(sessionId) : null;
    return storedSession?.summaryText
      ? { status: 'ready', response: storedSession.summaryText }
      : { status: 'loading', step: SUMMARY_LOADING_STEPS[0] };
  });
  const sidebarVisible = termWidth > WIDE_TERMINAL_BREAKPOINT;
  const contentWidth = Math.max(1, termWidth - (sidebarVisible ? SIDEBAR_WIDTH : 0) - 4);
  const [title, setTitle] = React.useState(truncate(prompt, 50));
  const contentHeight = Math.max(4, termHeight - 7);
  const ActiveMode = SESSION_MODES[activeModeIndex]?.Component ?? SummaryMode;

  React.useEffect(() => {
    if (!sessionId) {
      setSummaryState({ status: 'error', error: 'No active session was created.' });
      return;
    }

    const storedSession = getSessionById(sessionId);
    if (storedSession?.summaryText) {
      setSummaryState({ status: 'ready', response: storedSession.summaryText });
      setTitle(storedSession.title ?? truncate(prompt, 50));
      return;
    }

    setSummaryState({ status: 'loading', step: 'Checking session inputs' });

    if (!modelProvider || !model) {
      setSummaryState({ status: 'error', error: 'No model is selected for this session.' });
      return;
    }

    if (!materialPath || materialPath === 'Material') {
      setSummaryState({ status: 'error', error: 'No study material is attached to this session.' });
      return;
    }

    setSummaryState({ status: 'loading', step: 'Resolving material path' });

    const resolvedMaterialPath = materialPath.startsWith('http://') || materialPath.startsWith('https://')
      ? materialPath
      : fs.existsSync(materialPath)
        ? materialPath
        : '';
    const workingDirectory = resolvedMaterialPath && !resolvedMaterialPath.startsWith('http://') && !resolvedMaterialPath.startsWith('https://')
      ? path.dirname(resolvedMaterialPath)
      : undefined;

    if (!resolvedMaterialPath) {
      setSummaryState({ status: 'error', error: 'The selected study material could not be found.' });
      return;
    }

    const selectedProvider = createProvider(modelProvider);
    if (!selectedProvider) {
      setSummaryState({ status: 'error', error: 'The selected provider is unavailable.' });
      return;
    }

    const controller = new AbortController();
    const baseRequestOptions = {
      system: summarySystemPrompt,
      model,
      reasoningEffort,
      signal: controller.signal,
      workingDirectory,
      file: resolvedMaterialPath,
      responseSchema: SUMMARY_RESPONSE_SCHEMA,
    };

    setSummaryState({ status: 'loading', step: 'Preparing request' });

    const runSummary = async () => {
      try {
        let latestResponse = '';

        setSummaryState({ status: 'loading', step: 'Checking login' });

        for await (const event of selectedProvider.Prompt(buildSummaryUserPrompt(studyLanguage), baseRequestOptions)) {
          if (controller.signal.aborted) return;

          if (event.type === 'status') {
            if (!latestResponse) {
              setSummaryState({ status: 'loading', step: event.text });
            }
            continue;
          }

          latestResponse = event.text;

          const parsedSummary = parseSummaryPayload(latestResponse);
          if (parsedSummary?.content) {
            const storedSessionToUpdate = getSessionById(sessionId);
            if (storedSessionToUpdate) {
              saveSessionById(sessionId, {
                ...storedSessionToUpdate,
                title: parsedSummary.SessionTitle,
                summaryText: parsedSummary.content,
              });
            }

            const refreshedSession = getSessionById(sessionId);
            if (refreshedSession?.summaryText) {
              setSummaryState({ status: 'streaming', response: refreshedSession.summaryText });
            }
          }
        }

        if (!controller.signal.aborted) {
          const parsedSummary = parseSummaryPayload(latestResponse);

          if (parsedSummary?.content) {
            const storedSessionToUpdate = getSessionById(sessionId);
            if (storedSessionToUpdate) {
              saveSessionById(sessionId, {
                ...storedSessionToUpdate,
                title: parsedSummary.SessionTitle,
                summaryText: parsedSummary.content,
              });
            }

            const refreshedSession = getSessionById(sessionId);
            if (refreshedSession?.summaryText) {
              setSummaryState({ status: 'ready', response: refreshedSession.summaryText });
              return;
            }
          }

          setSummaryState({ status: 'error', error: 'No summary was generated.' });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSummaryState({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    void runSummary();

    return () => {
      controller.abort();
    };
  }, [materialPath, model, modelProvider, reasoningEffort, sessionId, studyLanguage]);

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
          <ActiveMode contentWidth={contentWidth} contentHeight={contentHeight} summaryState={summaryState} inputActive={inputActive} commandMenuActive={commandMenuActive} />
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
            onMenuVisibleChange={setCommandMenuActive}
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

interface SessionModeProps {
  contentWidth: number;
  contentHeight: number;
  summaryState: SummaryState;
  inputActive: boolean;
  commandMenuActive: boolean;
}

function SummaryMode({
  contentWidth,
  contentHeight,
  summaryState,
  inputActive,
  commandMenuActive,
}: SessionModeProps) {
  const [scroll, setScroll] = React.useState(0);
  const [animationFrame, setAnimationFrame] = React.useState(0);
  const lines = React.useMemo(() => buildSummaryLines(summaryState, Math.max(1, contentWidth), animationFrame), [animationFrame, contentWidth, summaryState]);
  const visibleRows = Math.max(1, contentHeight - 3);
  const maxScroll = Math.max(0, lines.length - visibleRows);
  const visibleLines = lines.slice(scroll, scroll + visibleRows);

  React.useEffect(() => {
    if (summaryState.status === 'loading' || summaryState.status === 'error') {
      setScroll(0);
    }
  }, [summaryState.status]);

  React.useEffect(() => {
    setScroll(current => Math.min(current, maxScroll));
  }, [maxScroll]);

  React.useEffect(() => {
    if (summaryState.status !== 'loading' && summaryState.status !== 'streaming') {
      setAnimationFrame(0);
      return;
    }

    const interval = setInterval(() => {
      setAnimationFrame(current => (current + 1) % 4);
    }, 450);

    return () => {
      clearInterval(interval);
    };
  }, [summaryState.status]);

  useInput((input, key) => {
    const mouseScroll = parseMouseWheelScroll(input);
    if (mouseScroll !== 0) {
      if (summaryState.status === 'ready' || summaryState.status === 'streaming') {
        setScroll(current => Math.max(0, Math.min(maxScroll, current + mouseScroll)));
      }
      return;
    }

    if (isTerminalMouseReport(input)) return;
    if (summaryState.status !== 'ready' && summaryState.status !== 'streaming') return;

    if (key.pageUp) {
      setScroll(current => Math.max(0, current - visibleRows));
      return;
    }

    if (key.pageDown) {
      setScroll(current => Math.min(maxScroll, current + visibleRows));
      return;
    }

    if (key.home) {
      setScroll(0);
      return;
    }

    if (key.end) {
      setScroll(maxScroll);
      return;
    }

    if (key.upArrow) {
      setScroll(current => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow) {
      setScroll(current => Math.min(maxScroll, current + 1));
    }
  }, { isActive: inputActive && !commandMenuActive });

  return (
    <Box flexDirection="column">
      <Box marginTop={1} marginBottom={1} justifyContent="space-between">
        <Text color={THEME.text} bold>Summary</Text>
        <Text color={THEME.textMuted}>
          {getSummaryStatusLabel(summaryState.status, maxScroll)}
        </Text>
      </Box>

      <Box height={visibleRows} flexDirection="row" overflow="hidden">
        <Box width={Math.max(1, contentWidth - (maxScroll > 0 ? 2 : 0))} flexDirection="column">
          {visibleLines.map((line, index) => (
            <Text
              key={`${scroll + index}:${line.text}`}
              color={line.color}
              bold={line.bold}
              dimColor={line.dim}
            >
              {line.text || ' '}
            </Text>
          ))}
        </Box>
        {maxScroll > 0 && (
          <ScrollBar
            height={visibleRows}
            scroll={scroll}
            totalRows={lines.length}
            visibleRows={visibleRows}
          />
        )}
      </Box>
    </Box>
  );
}

function ScrollBar({
  height,
  scroll,
  totalRows,
  visibleRows,
}: {
  height: number;
  scroll: number;
  totalRows: number;
  visibleRows: number;
}) {
  const trackHeight = Math.max(1, height);
  const thumbHeight = Math.max(1, Math.floor((visibleRows / totalRows) * trackHeight));
  const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
  const maxScroll = Math.max(1, totalRows - visibleRows);
  const thumbTop = Math.min(maxThumbTop, Math.round((scroll / maxScroll) * maxThumbTop));

  return (
    <Box width={2} flexDirection="column" alignItems="flex-end">
      {Array.from({ length: trackHeight }, (_, index) => {
        const active = index >= thumbTop && index < thumbTop + thumbHeight;

        return (
          <Text key={index} color={active ? THEME.primary : '#303030'}>
            {active ? '█' : '│'}
          </Text>
        );
      })}
    </Box>
  );
}

function QuizMode(_props: SessionModeProps) {
  return <ModePlaceholder name="Quiz" />;
}

function FlashCardsMode(_props: SessionModeProps) {
  return <ModePlaceholder name="FlashCards" />;
}

function ExercisesMode(_props: SessionModeProps) {
  return <ModePlaceholder name="Exercises" />;
}

function AiTeacherMode(_props: SessionModeProps) {
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

function buildSummaryUserPrompt(language: string) {
  return `Summarize the attached study material into structured study notes.\n\nReturn a JSON object with exactly these fields:\n- SessionTitle: a short session title\n- content: the full summary in Markdown\n\nIMPORTANT: Output raw JSON only. Do not wrap in markdown code fences or backticks. Do not include any explanation before or after the JSON object.\n\nRequirements for content:\n\nThe summary MUST be written in: ${language}\nFormat the content value in clean Markdown\nUse clear headings (##, ###) and subheadings\nUse bullet points for readability\nKeep all important ideas and concepts\nSimplify explanations where needed\nKeep it concise but complete\nAt the end, add a section called Key Points to Remember\nList the most important facts or ideas to memorize`;
}

function buildSummaryLines(summaryState: SummaryState, width: number, animationFrame: number): SummaryLine[] {
  if (summaryState.status === 'loading') {
    const activeStepIndex = Math.max(0, SUMMARY_LOADING_STEPS.indexOf(summaryState.step as typeof SUMMARY_LOADING_STEPS[number]));
    const dots = '.'.repeat((animationFrame % 3) + 1);

    return [
      { text: 'Preparing summary', color: THEME.text },
      ...SUMMARY_LOADING_STEPS.map((step, index) => {
        if (index < activeStepIndex) {
          return { text: `[x] ${step}`, color: THEME.success };
        }

        if (index === activeStepIndex) {
          return { text: `[>] ${step}${dots}`, color: THEME.text };
        }

        return { text: `[ ] ${step}`, color: THEME.textMuted };
      }),
    ].flatMap(line => wrapSummaryLine(line, width));
  }

  if (summaryState.status === 'error') {
    return wrapSummaryLine({ text: summaryState.error, color: '#ef4444' }, width);
  }

  if (summaryState.status === 'streaming') {
    return appendStreamingIndicator(buildMarkdownSummaryLines(summaryState.response, width), animationFrame);
  }

  return buildMarkdownSummaryLines(summaryState.response, width);
}

function getSummaryStatusLabel(status: SummaryState['status'], maxScroll: number) {
  if (status === 'ready') {
    return maxScroll > 0 ? '↑↓ scroll' : 'ready';
  }

  if (status === 'streaming') {
    return maxScroll > 0 ? 'streaming • ↑↓ scroll' : 'streaming';
  }

  return status;
}

function wrapSummaryLine(line: SummaryLine, width: number) {
  return wrapText(line.text, width).map(text => ({
    text,
    color: line.color,
    bold: line.bold,
    dim: line.dim,
  }));
}

function buildMarkdownSummaryLines(markdown: string, width: number) {
  const lines: SummaryLine[] = [];

  try {
    for (const token of lexer(markdown, { gfm: true })) {
      appendMarkdownToken(lines, token, width);
    }
  } catch {
    return wrapSummaryLine({ text: markdown, color: THEME.text }, width);
  }

  return trimBlankSummaryLines(lines).length > 0
    ? trimBlankSummaryLines(lines)
    : [{ text: ' ', color: THEME.textMuted }];
}

function appendMarkdownToken(lines: SummaryLine[], token: Token, width: number) {
  switch (token.type) {
    case 'space':
      appendBlankLine(lines);
      return;

    case 'heading': {
      appendBlankLine(lines);
      const heading = token as Tokens.Heading;
      const text = inlineText(heading.tokens) || heading.text;

      if (heading.depth === 1) {
        appendWrappedText(lines, text.toUpperCase(), width, { color: THEME.primary, bold: true });
        lines.push({ text: '─'.repeat(Math.min(text.length, width)), color: THEME.primary, dim: true });
      } else if (heading.depth === 2) {
        appendWrappedText(lines, text, width, { color: THEME.primary, bold: true });
      } else if (heading.depth === 3) {
        appendWrappedText(lines, text, width, { color: THEME.primary });
      } else {
        appendWrappedText(lines, text, width, { color: THEME.textMuted });
      }
      return;
    }

    case 'paragraph': {
      const paragraph = token as Tokens.Paragraph;
      appendWrappedText(lines, inlineText(paragraph.tokens) || paragraph.text, width, { color: THEME.text });
      return;
    }

    case 'text': {
      const text = token as Tokens.Text;
      appendWrappedText(lines, text.tokens ? inlineText(text.tokens) : text.text, width, { color: THEME.text });
      return;
    }

    case 'blockquote': {
      const quote = token as Tokens.Blockquote;
      const quoteLines = buildMarkdownLinesFromTokens(quote.tokens, Math.max(1, width - 2));
      for (const line of quoteLines) {
        appendWrappedText(lines, `| ${line.text}`, width, { color: THEME.textMuted, dim: true });
      }
      return;
    }

    case 'list':
      appendList(lines, token as Tokens.List, width);
      return;

    case 'code':
      appendCodeBlock(lines, token as Tokens.Code, width);
      return;

    case 'table':
      appendTable(lines, token as Tokens.Table, width);
      return;

    case 'hr':
      appendWrappedText(lines, '-'.repeat(Math.min(width, 40)), width, { color: THEME.textMuted, dim: true });
      return;

    case 'html': {
      const html = token as Tokens.HTML;
      appendWrappedText(lines, html.text, width, { color: THEME.textMuted, dim: true });
      return;
    }

    default:
      if ('tokens' in token && Array.isArray(token.tokens)) {
        for (const child of token.tokens) {
          appendMarkdownToken(lines, child, width);
        }
      } else if ('text' in token && typeof token.text === 'string') {
        appendWrappedText(lines, token.text, width, { color: THEME.text });
      }
  }
}

function buildMarkdownLinesFromTokens(tokens: Token[], width: number) {
  const lines: SummaryLine[] = [];
  for (const token of tokens) appendMarkdownToken(lines, token, width);
  return trimBlankSummaryLines(lines);
}

function appendList(lines: SummaryLine[], list: Tokens.List, width: number) {
  const start = typeof list.start === 'number' ? list.start : 1;

  list.items.forEach((item, index) => {
    const marker = list.ordered ? `${start + index}.` : '-';
    const checkbox = item.task ? `${item.checked ? '[x]' : '[ ]'} ` : '';
    const prefix = `${marker} ${checkbox}`;
    const childLines = buildMarkdownLinesFromTokens(item.tokens, Math.max(1, width - prefix.length));

    if (childLines.length === 0) {
      appendWrappedText(lines, prefix.trimEnd(), width, { color: THEME.text });
      return;
    }

    childLines.forEach((line, childIndex) => {
      const linePrefix = childIndex === 0 ? prefix : ' '.repeat(prefix.length);
      appendWrappedText(lines, `${linePrefix}${line.text}`, width, {
        color: line.color,
        bold: line.bold,
        dim: line.dim,
      });
    });
  });
}

function appendCodeBlock(lines: SummaryLine[], code: Tokens.Code, width: number) {
  appendBlankLine(lines);
  if (code.lang) {
    appendWrappedText(lines, code.lang, width, { color: THEME.textMuted, dim: true });
  }

  const codeLines = code.text.split('\n');
  for (const line of codeLines.length > 0 ? codeLines : ['']) {
    appendWrappedText(lines, line || ' ', width, { color: '#f4c7a1' });
  }
  appendBlankLine(lines);
}

function appendTable(lines: SummaryLine[], table: Tokens.Table, width: number) {
  const rows = [table.header, ...table.rows];
  const columnWidths = table.header.map((_, columnIndex) => {
    const widestCell = rows.reduce((widest, row) => Math.max(widest, inlineText(row[columnIndex]?.tokens ?? []).length), 0);
    return Math.min(Math.max(1, widestCell), Math.max(1, Math.floor(width / Math.max(1, table.header.length)) - 2));
  });

  rows.forEach((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => truncate(inlineText(cell.tokens), columnWidths[columnIndex] ?? 8).padEnd(columnWidths[columnIndex] ?? 8));
    appendWrappedText(lines, cells.join('  ').trimEnd(), width, {
      color: rowIndex === 0 ? THEME.primary : THEME.text,
      bold: rowIndex === 0,
    });
  });
}

function appendWrappedText(lines: SummaryLine[], text: string, width: number, style: Omit<SummaryLine, 'text'>) {
  for (const wrapped of wrapText(text, width)) {
    lines.push({ text: wrapped, ...style });
  }
}

function appendBlankLine(lines: SummaryLine[]) {
  const previous = lines[lines.length - 1];
  if (!previous || previous.text === '') return;
  lines.push({ text: '', color: THEME.textMuted });
}

function trimBlankSummaryLines(lines: SummaryLine[]) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.text === '') start += 1;
  while (end > start && lines[end - 1]?.text === '') end -= 1;

  return lines.slice(start, end);
}

function inlineText(tokens: Token[]): string {
  return tokens.map(token => {
    switch (token.type) {
      case 'text':
      case 'escape':
      case 'codespan':
      case 'html':
        return 'text' in token && typeof token.text === 'string' ? token.text : '';

      case 'strong':
      case 'em':
      case 'del':
        return inlineText((token as Tokens.Strong | Tokens.Em | Tokens.Del).tokens);

      case 'link': {
        const link = token as Tokens.Link;
        const label = inlineText(link.tokens) || link.text;
        return link.href ? `${label} (${link.href})` : label;
      }

      case 'image': {
        const image = token as Tokens.Image;
        return image.href ? `${image.text || 'image'} (${image.href})` : image.text;
      }

      case 'br':
        return '\n';

      default:
        if ('tokens' in token && Array.isArray(token.tokens)) return inlineText(token.tokens);
        if ('text' in token && typeof token.text === 'string') return token.text;
        return '';
    }
  }).join('');
}

function appendStreamingIndicator(lines: SummaryLine[], animationFrame: number) {
  const indicator = '.'.repeat((animationFrame % 3) + 1);

  if (lines.length === 0) {
    return [{ text: indicator, color: THEME.textMuted }];
  }

  return lines.map((line, index) => {
    if (index !== lines.length - 1) return line;

    return {
      ...line,
      text: `${line.text}${indicator}`,
    };
  });
}

function parseSummaryPayload(response: string): { SessionTitle: string; content: string } | null {
  let normalizedResponse = response.trim();
  if (!normalizedResponse) return null;

  // Strip complete markdown code fences (```json ... ```) if the model added them despite instructions.
  // Partial/incomplete fences during streaming won't match the closing fence so fall through safely.
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(normalizedResponse);
  if (fenceMatch?.[1]) normalizedResponse = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(normalizedResponse) as unknown;
    return looksLikeSummaryPayload(parsed) ? parsed : null;
  } catch {
    return extractPartialSummaryPayload(normalizedResponse);
  }
}

function looksLikeSummaryPayload(value: unknown): value is { SessionTitle: string; content: string } {
  return typeof value === 'object'
    && value !== null
    && 'SessionTitle' in value
    && typeof value.SessionTitle === 'string'
    && 'content' in value
    && typeof value.content === 'string';
}

function extractPartialSummaryPayload(response: string) {
  const titleMatch = /"SessionTitle"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/u.exec(response);
  const contentMatch = /"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/u.exec(response);
  if (!titleMatch || !contentMatch) return null;

  return {
    SessionTitle: decodePartialJsonString(titleMatch[1] ?? ''),
    content: decodePartialJsonString(contentMatch[1] ?? ''),
  };
}

function decodePartialJsonString(value: string) {
  let index = 0;
  let content = '';

  while (index < value.length) {
    const character = value[index];

    if (character !== '\\') {
      content += character;
      index += 1;
      continue;
    }

    const nextCharacter = value[index + 1];
    if (!nextCharacter) return content;

    if (nextCharacter === 'n') {
      content += '\n';
      index += 2;
      continue;
    }

    if (nextCharacter === 'r') {
      content += '\r';
      index += 2;
      continue;
    }

    if (nextCharacter === 't') {
      content += '\t';
      index += 2;
      continue;
    }

    if (nextCharacter === '"' || nextCharacter === '\\' || nextCharacter === '/') {
      content += nextCharacter;
      index += 2;
      continue;
    }

    if (nextCharacter === 'b') {
      content += '\b';
      index += 2;
      continue;
    }

    if (nextCharacter === 'f') {
      content += '\f';
      index += 2;
      continue;
    }

    if (nextCharacter === 'u') {
      const unicodeHex = value.slice(index + 2, index + 6);
      if (/^[0-9a-fA-F]{4}$/u.test(unicodeHex)) {
        content += String.fromCharCode(Number.parseInt(unicodeHex, 16));
        index += 6;
        continue;
      }

      return content;
    }

    content += nextCharacter;
    index += 2;
  }

  return content;
}

function wrapText(text: string, width: number) {
  return text
    .split('\n')
    .flatMap(line => {
      if (!line) return [''];

      const chunks: string[] = [];
      for (let index = 0; index < line.length; index += width) {
        chunks.push(line.slice(index, index + width));
      }

      return chunks.length > 0 ? chunks : [''];
    });
}
