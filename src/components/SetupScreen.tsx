import React from 'react';
import { Box, Text, useInput } from 'ink';
import { ProviderSelector } from './ProviderSelector.js';
import { ApiKeyInput } from './ApiKeyInput.js';
import { saveConfig, CONFIG_FILE } from '../utils/config.js';
import { PROVIDERS } from '../types/index.js';
import type { Provider } from '../types/index.js';

type Step = 'welcome' | 'provider' | 'apikey' | 'saving' | 'done';

// ─── Layout helpers ────────────────────────────────────────────────────────────

const Divider: React.FC = () => (
  <Text dimColor>{'─'.repeat(42)}</Text>
);

const Logo: React.FC = () => (
  <Box flexDirection="column" marginBottom={1}>
    <Text bold color="cyan">
      OpenStudy CLI
    </Text>
    <Text color="gray">AI-powered study assistant</Text>
    <Box marginTop={1} flexDirection="column">
      <Text dimColor>Implemented by Itri Cloud Labs</Text>
      <Text dimColor>Powered by Itri Cloud</Text>
    </Box>
  </Box>
);

// ─── Welcome step ──────────────────────────────────────────────────────────────

interface WelcomeStepProps {
  onContinue: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onContinue }) => {
  useInput((_ch, key) => {
    if (key.return || _ch === ' ') onContinue();
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="white">
        Welcome! Let&apos;s set up your environment.
      </Text>
      <Text dimColor>
        This wizard will configure your AI provider and API key.
      </Text>
      <Text dimColor>Press enter to begin…</Text>
    </Box>
  );
};

// ─── Saving step ───────────────────────────────────────────────────────────────

interface SavingStepProps {
  provider: Provider;
  apiKey: string;
  onDone: () => void;
}

const SavingStep: React.FC<SavingStepProps> = ({ provider, apiKey, onDone }) => {
  React.useEffect(() => {
    saveConfig({ provider, apiKey });
    const t = setTimeout(onDone, 600);
    return () => clearTimeout(t);
  }, []);

  return <Text color="yellow">Saving configuration…</Text>;
};

// ─── Done step ─────────────────────────────────────────────────────────────────

interface DoneStepProps {
  provider: Provider;
  onExit: () => void;
}

const DoneStep: React.FC<DoneStepProps> = ({ provider, onExit }) => {
  const label = PROVIDERS.find(p => p.id === provider)?.label ?? provider;

  useInput((_ch, key) => {
    if (_ch === 'q' || key.escape || (key.ctrl && _ch === 'c')) {
      onExit();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">
        ✓ Setup complete!
      </Text>
      <Text color="white">
        Provider: <Text color="cyan">{label}</Text>
      </Text>
      <Text dimColor>Config saved to {CONFIG_FILE}</Text>
      <Box marginTop={1}>
        <Text color="white">You can now start using OpenStudy CLI.</Text>
      </Box>
      <Text dimColor>Press q or esc to exit.</Text>
    </Box>
  );
};

// ─── SetupScreen ───────────────────────────────────────────────────────────────

interface SetupScreenProps {
  onExit: () => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onExit }) => {
  const [step, setStep]         = React.useState<Step>('welcome');
  const [provider, setProvider] = React.useState<Provider | null>(null);
  const [apiKey, setApiKey]     = React.useState('');

  const providerMeta = provider ? PROVIDERS.find(p => p.id === provider) : null;

  const handleProviderSelect = (selected: Provider) => {
    setProvider(selected);
    const meta = PROVIDERS.find(p => p.id === selected)!;
    // Ollama doesn't need a key — skip straight to saving
    setStep(meta.requiresKey ? 'apikey' : 'saving');
  };

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setStep('saving');
  };

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      <Logo />
      <Divider />

      {step === 'welcome' && (
        <WelcomeStep onContinue={() => setStep('provider')} />
      )}

      {step === 'provider' && (
        <ProviderSelector onSelect={handleProviderSelect} />
      )}

      {step === 'apikey' && provider && (
        <ApiKeyInput
          providerLabel={providerMeta?.label ?? provider}
          onSubmit={handleApiKeySubmit}
        />
      )}

      {step === 'saving' && provider && (
        <SavingStep
          provider={provider}
          apiKey={apiKey}
          onDone={() => setStep('done')}
        />
      )}

      {step === 'done' && provider && (
        <DoneStep provider={provider} onExit={onExit} />
      )}
    </Box>
  );
};
