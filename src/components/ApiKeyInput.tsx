import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ApiKeyInputProps {
  providerLabel: string;
  onSubmit: (apiKey: string) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ providerLabel, onSubmit }) => {
  const [value, setValue] = React.useState('');
  const [error, setError]  = React.useState('');

  useInput((input, key) => {
    if (key.return) {
      if (value.trim().length === 0) {
        setError('API key cannot be empty.');
        return;
      }
      onSubmit(value.trim());
      return;
    }

    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
      setError('');
      return;
    }

    // Ignore non-printable keys
    if (key.ctrl || key.meta || key.escape) return;

    setValue(prev => prev + input);
    setError('');
  });

  const masked = '●'.repeat(value.length);

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="white">
        Enter your {providerLabel} API key:
      </Text>

      <Box borderStyle="round" borderColor={error ? 'red' : 'gray'} paddingX={1}>
        <Text color={value.length > 0 ? 'white' : 'gray'}>
          {value.length > 0 ? masked : 'Type your key…'}
        </Text>
      </Box>

      {error ? (
        <Text color="red">{error}</Text>
      ) : (
        <Text dimColor>Input is hidden   enter to confirm</Text>
      )}
    </Box>
  );
};
