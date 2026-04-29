import React from 'react';
import { Box, Text, useInput } from 'ink';
import { PROVIDERS } from '../types/index.js';
import type { Provider } from '../types/index.js';

interface ProviderSelectorProps {
  onSelect: (provider: Provider) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ onSelect }) => {
  const [cursor, setCursor] = React.useState(0);

  useInput((_, key) => {
    if (key.upArrow) {
      setCursor(prev => (prev - 1 + PROVIDERS.length) % PROVIDERS.length);
    } else if (key.downArrow) {
      setCursor(prev => (prev + 1) % PROVIDERS.length);
    } else if (key.return) {
      onSelect(PROVIDERS[cursor]!.id);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="white">
        Select an AI provider:
      </Text>
      <Box flexDirection="column">
        {PROVIDERS.map((provider, index) => {
          const isActive = index === cursor;
          return (
            <Box key={provider.id} paddingLeft={1}>
              <Text color={isActive ? 'cyan' : 'gray'}>
                {isActive ? '❯ ' : '  '}
                {provider.label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Text dimColor>↑ ↓ navigate   enter select</Text>
    </Box>
  );
};
