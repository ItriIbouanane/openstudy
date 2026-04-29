import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { Logo } from './Logo.js';

const LOADING_FRAMES = ['|', '/', '-', '\\'];
const TROLL_MESSAGES = [
  'Convincing the pencils to stop unionizing...',
  'Sharpening PDFs with a butter knife...',
  'Teaching the loading bar to read...',
  'Asking the mitochondria for extra power...',
  'Pretending this is very scientific...',
];

interface LoadingScreenProps {
  firstLaunch?: boolean;
  preloadReady?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ firstLaunch = false, preloadReady = false }) => {
  const { stdout } = useStdout();
  const [frame, setFrame] = React.useState(0);
  const [messageIndex, setMessageIndex] = React.useState(0);
  const termWidth = stdout?.columns ?? process.stdout.columns ?? 80;
  const termHeight = stdout?.rows ?? process.stdout.rows ?? 24;

  React.useEffect(() => {
    const id = setInterval(() => {
      setFrame(current => (current + 1) % LOADING_FRAMES.length);
    }, 120);

    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!firstLaunch || !preloadReady) return;

    const id = setInterval(() => {
      setMessageIndex(current => (current + 1) % TROLL_MESSAGES.length);
    }, 1000);

    return () => clearInterval(id);
  }, [firstLaunch, preloadReady]);

  return (
    <Box position="absolute" top={0} left={0} width={termWidth} height={termHeight} flexDirection="column" alignItems="center" justifyContent="center" backgroundColor="#000000">
      <Box marginBottom={2}>
        <Logo />
      </Box>
      <Text color="#f0a500" bold>{LOADING_FRAMES[frame]} Loading OpenStudy</Text>
      <Text color="#555555">{firstLaunch && preloadReady ? TROLL_MESSAGES[messageIndex] : 'Preparing commands and modals...'}</Text>
    </Box>
  );
};
