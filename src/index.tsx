#!/usr/bin/env node
import fs from 'fs';
import React from 'react';
import { render } from 'ink';
import { HomeScreen, LoadingScreen, SetupScreen } from './components/index.js';
import { loadCommands } from './commands/index.js';
import { loadModalManifests } from './modals/index.js';
import { closeProviders } from './providers/index.js';
import { CONFIG_DIR } from './utils/config.js';

type Screen = 'home' | 'setup';

const MIN_LOADING_MS = 350;
const FIRST_LAUNCH_LOADING_MS = 4000;
const ANSI_ENABLE_MOUSE_POINTER = '\x1b[?1000h\x1b[?1006h';
// Clear the common mouse-tracking modes so a stale session cannot leave the terminal stuck.
const ANSI_DISABLE_MOUSE_POINTER = '\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1005l\x1b[?1006l\x1b[?1015l\x1b[?1007l';

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

function writeTerminal(sequence: string) {
  if (!process.stdout.isTTY || !process.stdout.writable) return;

  try {
    process.stdout.write(sequence);
  } catch {
    // Ignore terminal write failures during shutdown.
  }
}

let mousePointerEnabled = false;
let shuttingDown = false;

function enableDefaultMousePointer() {
  if (mousePointerEnabled || shuttingDown) return;

  writeTerminal(ANSI_ENABLE_MOUSE_POINTER);
  mousePointerEnabled = true;
}

function restoreMousePointer() {
  writeTerminal(ANSI_DISABLE_MOUSE_POINTER);
  mousePointerEnabled = false;
}

let unmountApp: (() => void) | undefined;

function shutdownApp() {
  if (shuttingDown) return;

  shuttingDown = true;
  void closeProviders();
  unmountApp?.();
  restoreMousePointer();
}

function exitApp(code: number) {
  shutdownApp();
  process.exit(code);
}

function registerProcessHandlers() {
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => exitApp(0));
  }

  process.once('uncaughtException', error => {
    shutdownApp();
    throw error;
  });

  process.once('unhandledRejection', error => {
    shutdownApp();
    throw error;
  });

  process.once('beforeExit', restoreMousePointer);
  process.once('exit', restoreMousePointer);
}

// Reset any stale mouse-tracking mode before Ink takes over the terminal.
restoreMousePointer();
registerProcessHandlers();

const { unmount } = render(<App onExit={() => {
  shutdownApp();
}} />, {
  alternateScreen: true,
  onRender: enableDefaultMousePointer,
});

unmountApp = unmount;
