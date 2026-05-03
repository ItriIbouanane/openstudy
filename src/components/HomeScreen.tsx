import React from 'react';
import path from 'path';
import { Box, Text, useInput, useStdout } from 'ink';
import { Logo } from './Logo.js';
import { PromptInput } from './PromptInput.js';
import { SessionScreen } from './SessionScreen.js';
import { loadCommands, type CommandContext, type CommandModule } from '../commands/index.js';
import { subjects, type SubjectOption } from '../options/index.js';
import { loadSession, UpdateSettings } from '../utils/config.js';
import { isTerminalMouseReport } from '../utils/input.js';
import { PROVIDERS, type Provider } from '../types/index.js';
import { ModalHost, loadModalManifests, loadModalModule, type ActiveModal, type ModalManifest, type ModalRenderContext, type ModalScreen, type ModalState, type ModalTrigger, type SelectedModel } from '../modals/index.js';
import { getProviderDefinition } from '../providers/index.js';

const VERSION = '0.1.0';
const CONTENT_SIDE_PADDING = 3;
const PROMPT_MAX_WIDTH = 100;
const PROMPT_MAX_WIDTH_WIDE = 125;
const WIDE_TERMINAL_BREAKPOINT = 192;

// ANSI: set default background to black, clear screen
const ANSI_BG_BLACK   = '\x1b[40m';
const ANSI_BG_DEFAULT = '\x1b[49m';
const ANSI_CLEAR      = '\x1b[2J\x1b[H';

const TIPS = [
  'Use tab to browse available study agents.',
  'Press ctrl+p to open the command palette.',
  'Type a topic and press enter to start a session.',
  'Agents can search the web, summarize, and quiz you.',
];

interface HomeScreenProps {
  onExit: () => void;
  onSetup: () => void;
  onReady?: () => void;
  inputDisabled?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onExit, onSetup, onReady, inputDisabled = false }) => {
  const { stdout } = useStdout();

  // Track terminal dimensions in state so resize triggers a re-render
  const [termSize, setTermSize] = React.useState(() => ({
    width:  stdout?.columns ?? process.stdout.columns ?? 80,
    height: stdout?.rows    ?? process.stdout.rows    ?? 24,
  }));
  const [commands, setCommands] = React.useState<CommandModule[]>([]);
  const [session, setSession] = React.useState(() => loadSession());
  const [sessionPrompt, setSessionPrompt] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ActiveModal | null>(null);
  const [modalManifests, setModalManifests] = React.useState<ModalManifest[]>([]);
  const modalContextRef = React.useRef<ModalRenderContext | null>(null);
  const currentScreen: ModalScreen = sessionPrompt ? 'session' : 'home';
  const selectedSubject = React.useMemo<SubjectOption | null>(
    () => subjects.find(subject => subject.name === session.subject) ?? subjects.find(subject => subject.default) ?? null,
    [session.subject],
  );
  const selectedModel = React.useMemo<SelectedModel | null>(
    () => {
      if (!session.modelProvider || !session.model) return null;
      return { provider: session.modelProvider, name: session.model };
    },
    [session.modelProvider, session.model],
  );
  const selectedModelLabel = React.useMemo(() => {
    if (!selectedModel) return 'Provider/Model';

    const providerLabel = getProviderDefinition(selectedModel.provider)?.label ?? selectedModel.provider;
    return `${providerLabel}/${selectedModel.name}`;
  }, [selectedModel]);
  const selectedProviderLabel = React.useMemo(() => {
    if (!selectedModel) return 'Provider';
    return getProviderDefinition(selectedModel.provider)?.label ?? selectedModel.provider;
  }, [selectedModel]);
  const materialLabel = React.useMemo(() => formatMaterialLabel(session.material), [session.material]);
  const config = React.useMemo(
    () => session.provider ? { provider: session.provider, apiKey: session.apiKey } : null,
    [session],
  );

  const updateSession = React.useCallback((patch: Partial<typeof session>) => {
    const next = UpdateSettings(patch);
    setSession(next);
    return next;
  }, []);

  React.useEffect(() => {
    onReady?.();
  }, [onReady]);

  React.useEffect(() => {
    let mounted = true;

    void loadCommands()
      .then(loaded => {
        if (mounted) setCommands(loaded);
      })
      .catch(() => {
        if (mounted) setCommands([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    void loadModalManifests()
      .then(manifests => {
        if (mounted) setModalManifests(manifests);
      })
      .catch(() => {
        if (mounted) setModalManifests([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Force solid black terminal background on mount, restore on unmount
  // Also listen for terminal resize events
  React.useEffect(() => {
    stdout?.write(ANSI_BG_BLACK + ANSI_CLEAR);

    const updateSize = () => {
      setTermSize({
        width:  stdout?.columns ?? process.stdout.columns ?? 80,
        height: stdout?.rows    ?? process.stdout.rows    ?? 24,
      });
    };

    // Trigger an immediate measurement after mount
    updateSize();

    stdout?.on('resize', updateSize);
    process.stdout.on('resize', updateSize);

    return () => {
      stdout?.write(ANSI_BG_DEFAULT);
      stdout?.off('resize', updateSize);
      process.stdout.off('resize', updateSize);
    };
  }, [stdout]);

  const tip = React.useMemo(
    () => TIPS[Math.floor(Math.random() * TIPS.length)]!,
    [],
  );

  const cwd = process.cwd().replace(process.env['HOME'] ?? '', '~');

  const isProviderConfigured = React.useCallback((provider: Provider) => {
    const meta = PROVIDERS.find(item => item.id === provider);
    if (!meta || config?.provider !== provider) return false;
    return !meta.requiresKey || config.apiKey.trim().length > 0;
  }, [config]);

  const closeModal = React.useCallback(() => {
    setModal(null);
  }, []);

  const availableModalTriggers = React.useMemo(
    () => modalManifests.flatMap(manifest => isModalAvailableOnScreen(manifest, currentScreen) && manifest.trigger ? [manifest.trigger] : []),
    [currentScreen, modalManifests],
  );

  const updateModal = React.useCallback((updater: ModalState | ((current: ModalState) => ModalState)) => {
    setModal(current => {
      if (!current) return current;
      const nextState = typeof updater === 'function' ? updater(current.state) : updater;
      return { ...current, state: nextState };
    });
  }, []);

  const openModal = React.useCallback(async (id: string, initialState?: Record<string, unknown>) => {
    const manifests = modalManifests.length > 0 ? modalManifests : await loadModalManifests();
    const manifest = manifests.find(item => item.id === id);
    const module = await loadModalModule(id);
    const context = modalContextRef.current;
    if (!manifest || !isModalAvailableOnScreen(manifest, currentScreen) || !module || !context) return;

    const state = await module.open(context, initialState);
    if (!state) return;

    setModal({ id, module, state });
  }, [currentScreen, modalManifests]);

  const modalRenderContext = React.useMemo<ModalRenderContext>(() => ({
    session,
    config,
    selectedSubject,
    selectedModel,
    openModal,
    closeModal,
    updateModal,
    updateSettings: updateSession,
    isProviderConfigured,
  }), [closeModal, config, isProviderConfigured, openModal, selectedModel, selectedSubject, session, updateModal, updateSession]);
  modalContextRef.current = modalRenderContext;

  const executeModalTrigger = React.useCallback((trigger: ModalTrigger) => {
    const manifest = modalManifests.find(item => item.trigger?.id === trigger.id);
    if (manifest) void openModal(manifest.id);
  }, [modalManifests, openModal]);

  useInput((input, key) => {
    if (inputDisabled) return;
    if (isTerminalMouseReport(input)) return;

    if (modal) {
      const handled = modal.module.handleInput?.({ input, key, modal: modal.state, context: modalRenderContext }) ?? false;
      if (handled) return;

      if (key.ctrl && input === 'c') {
        closeModal();
        return;
      }

      return;
    }

    if (key.ctrl && input === 'c') onExit();
  });

  const commandContext = React.useMemo<CommandContext>(() => ({
    onExit,
    onSetup,
    openModal: (id, modal) => void openModal(id, modal),
    closeModal,
  }), [closeModal, onExit, onSetup, openModal]);

  const handleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed.startsWith('/')) {
      if (hasCompleteSessionOptions(session, selectedSubject, selectedModel)) setSessionPrompt(trimmed);
      return;
    }

    const name = trimmed.slice(1).split(/\s+/, 1)[0];
    const command = commands.find(item => item.config.name === name);
    if (!command) return;

    void command.execute(commandContext);
  };

  const termWidth  = termSize.width;
  const termHeight = termSize.height;
  const promptMaxWidth = termWidth >= WIDE_TERMINAL_BREAKPOINT ? PROMPT_MAX_WIDTH_WIDE : PROMPT_MAX_WIDTH;
  const promptWidth = Math.max(1, Math.min(termWidth - CONTENT_SIDE_PADDING * 2, promptMaxWidth));

  const MIN_WIDTH  = 73;
  const MIN_HEIGHT = 23;

  if (termWidth < MIN_WIDTH || termHeight < MIN_HEIGHT) {
    return (
      <Box width={termWidth} height={termHeight} flexDirection="column" alignItems="center" justifyContent="center" backgroundColor="#000000">
        <Text color="#f0a500" bold>Terminal too small</Text>
        <Text color="#555555">
          {termWidth}×{termHeight}{'  '}
          <Text color="#888888">minimum </Text>
          {MIN_WIDTH}×{MIN_HEIGHT}
        </Text>
        <Text color="#3d3d3d">Resize your terminal window to continue.</Text>
      </Box>
    );
  }

  // Logo = 6 rows, gap = 2, compact input box = 3, hints = 1, gap = 2, tip = 1 → ~15
  const contentHeight = 16;
  const topPad = Math.max(2, Math.floor((termHeight - contentHeight) / 2));

  if (sessionPrompt) {
    return (
      <SessionScreen
        termWidth={termWidth}
        termHeight={termHeight}
        prompt={sessionPrompt}
        subject={selectedSubject?.name ?? 'Subject'}
        subjectColor={selectedSubject?.color ?? '#3b82f6'}
        provider={selectedProviderLabel}
        model={selectedModel?.name ?? selectedModelLabel}
        reasoningEffort={session.reasoningEffort}
        material={materialLabel}
        studyLanguage={session.studyLanguage}
        cwd={cwd}
        commands={commands}
        commandContext={commandContext}
        inputActive={!modal && !inputDisabled}
        modal={modal}
        modalContext={modalRenderContext}
        modalTriggers={availableModalTriggers}
        onModalTrigger={executeModalTrigger}
      />
    );
  }

  return (
    <Box
      flexDirection="column"
      width={termWidth}
      height={termHeight}
      backgroundColor="#000000"
    >
      {/* ── Top spacer for vertical centering ── */}
      <Box height={topPad} flexShrink={0} />

      <Box justifyContent="center" marginBottom={2}>
        <Logo />
      </Box>

      {/* ── Prompt input ── */}
      <Box justifyContent="center">
        <PromptInput
          onSubmit={handleSubmit}
          commands={commands}
          commandContext={commandContext}
          width={promptWidth}
          inputActive={!modal && !inputDisabled}
          modalTriggers={availableModalTriggers}
          onModalTrigger={executeModalTrigger}
          placeholder={`Not sure what to ask ? Just say Hi and ${selectedModelLabel} will guide you`}
          subject={selectedSubject?.name ?? 'Subject'}
          subjectColor={selectedSubject?.color ?? '#3b82f6'}
          model={selectedModelLabel}
          reasoningEffort={session.reasoningEffort}
          material={materialLabel}
          studyLanguage={session.studyLanguage}
        />
      </Box>

      {/* ── Keyboard hints right-aligned under the box ── */}
      <Box justifyContent="center" marginTop={1}>
        <Box width={promptWidth} justifyContent="flex-end">
          <Text dimColor>
            <Text color="#cccccc">tab</Text>
            <Text color="#555555"> subject  </Text>
            <Text color="#cccccc">ctrl+m</Text>
            <Text color="#555555"> model  </Text>
            <Text color="#cccccc">ctrl+r</Text>
            <Text color="#555555"> reasoning  </Text>
            <Text color="#cccccc">ctrl+f</Text>
            <Text color="#555555"> material  </Text>
            <Text color="#cccccc">ctrl+l</Text>
            <Text color="#555555"> language</Text>
          </Text>
        </Box>
      </Box>

      {/* ── Tip ── */}
      <Box justifyContent="center" marginTop={2}>
        <Box width={promptWidth}>
          <Text color="#f0a500">{'● '}</Text>
          <Text color="#f0a500" bold>Tip</Text>
          <Text color="#555555">{' ' + tip}</Text>
        </Box>
      </Box>

      {/* ── Push status bar to bottom ── */}
      <Box flexGrow={1} />

      {/* ── Bottom status bar ── */}
      <Box flexDirection="row" justifyContent="space-between" paddingX={2}>
        <Text color="#444444">{cwd}</Text>
        <Text color="#444444">{VERSION}</Text>
      </Box>

      {modal && <ModalHost modal={modal} termWidth={termWidth} termHeight={termHeight} context={modalRenderContext} />}
    </Box>
  );
};

function hasCompleteSessionOptions(
  session: ReturnType<typeof loadSession>,
  selectedSubject: SubjectOption | null,
  selectedModel: SelectedModel | null,
) {
  return Boolean(
    selectedSubject
    && selectedModel
    && session.reasoningEffort !== 'Reasoning effort'
    && session.material !== 'Material'
    && session.studyLanguage !== 'Study Language'
  );
}

function formatMaterialLabel(material: string) {
  if (!material || material === 'Material') return material;

  const normalized = material.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return truncateMaterialLabel(normalized);

  const parent = path.basename(path.dirname(normalized));
  const file = path.basename(normalized);

  const label = !parent || parent === '.' || parent === path.sep ? file : `${parent}/${file}`;
  return truncateMaterialLabel(label);
}

function truncateMaterialLabel(label: string) {
  return label.length > 50 ? `${label.slice(0, 47)}...` : label;
}

function isModalAvailableOnScreen(manifest: ModalManifest, screen: ModalScreen) {
  return manifest.Screen === null || manifest.Screen === screen;
}
