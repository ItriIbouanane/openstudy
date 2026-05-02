#!/usr/bin/env node
import fs from 'fs';
import React from 'react';
import { render } from 'ink';
import { HomeScreen, LoadingScreen, SetupScreen } from './components/index.js';
import { loadCommands } from './commands/index.js';
import { loadModalManifests } from './modals/index.js';
import { CONFIG_DIR } from './utils/config.js';

type Screen = 'home' | 'setup';

const MIN_LOADING_MS = 350;
const FIRST_LAUNCH_LOADING_MS = 4000;
const ANSI_ENABLE_MOUSE_POINTER = '\x1b[?1000h\x1b[?1006h';
const ANSI_DISABLE_MOUSE_POINTER = '\x1b[?1000l\x1b[?1006l';

const App: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [screen, setScreen] = React.useState<Screen>('home');
  const [homeReady, setHomeReady] = React.useState(false);
  const [preloadReady, setPreloadReady] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const startedAt = React.useRef(Date.now());
  const firstLaunch = React.useRef(isFirstLaunch());

  React.useEffect(() => {
    let mounted = true;

    void Promise.allSettled([loadCommands(), loadModalManifests()]).then(() => {
      if (mounted) setPreloadReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!loading || !homeReady || !preloadReady) return;

    const minLoadingMs = firstLaunch.current ? FIRST_LAUNCH_LOADING_MS : MIN_LOADING_MS;
    const remaining = Math.max(0, minLoadingMs - (Date.now() - startedAt.current));
    const id = setTimeout(() => setLoading(false), remaining);

    return () => clearTimeout(id);
  }, [homeReady, loading, preloadReady]);

  return (
    <>
      {screen === 'setup' ? (
        <SetupScreen onExit={onExit} />
      ) : (
        <>
          <HomeScreen
            onExit={onExit}
            onSetup={() => setScreen('setup')}
            onReady={() => setHomeReady(true)}
            inputDisabled={loading}
          />
          {loading && <LoadingScreen firstLaunch={firstLaunch.current} preloadReady={preloadReady} />}
        </>
      )}
    </>
  );
};

function isFirstLaunch() {
  if (!fs.existsSync(CONFIG_DIR)) return true;

  try {
    return fs.readdirSync(CONFIG_DIR).length === 0;
  } catch {
    return true;
  }
}

function enableDefaultMousePointer() {
  process.stdout.write(ANSI_ENABLE_MOUSE_POINTER);
}

function restoreMousePointer() {
  process.stdout.write(ANSI_DISABLE_MOUSE_POINTER);
}

enableDefaultMousePointer();

let unmountApp: (() => void) | undefined;

const { unmount } = render(<App onExit={() => {
  unmountApp?.();
  restoreMousePointer();
}} />, {
  alternateScreen: true,
  onRender: enableDefaultMousePointer,
});

unmountApp = unmount;

process.on('exit', restoreMousePointer);
