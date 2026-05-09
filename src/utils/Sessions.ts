import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { SessionSettings } from '../types/index.js';
import { CONFIG_DIR, DEFAULT_SESSION, loadSession, saveSession } from './config.js';

const SESSION_FILENAME = 'session.json';

function normalizeStoredSession(value: unknown, fallbackSessionId: string | null = null): SessionSettings {
  const raw = value && typeof value === 'object' ? value as Partial<SessionSettings> : {};

  return {
    ...DEFAULT_SESSION,
    ...raw,
    sessionId: typeof raw.sessionId === 'string' && raw.sessionId.trim().length > 0 ? raw.sessionId : fallbackSessionId,
    title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title : null,
    summaryText: typeof raw.summaryText === 'string' ? raw.summaryText : null,
    createdDate: typeof raw.createdDate === 'string' ? raw.createdDate : null,
    lastOpenedDate: typeof raw.lastOpenedDate === 'string' ? raw.lastOpenedDate : null,
  };
}

export function getSessionDirectory(sessionId: string) {
  return path.join(CONFIG_DIR, sessionId);
}

export function getSessionFilePath(sessionId: string) {
  return path.join(getSessionDirectory(sessionId), SESSION_FILENAME);
}

export function getAllSession(): SessionSettings[] {
  if (!fs.existsSync(CONFIG_DIR)) return [];

  return fs.readdirSync(CONFIG_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => {
      const sessionFilePath = getSessionFilePath(entry.name);
      if (!fs.existsSync(sessionFilePath)) return null;

      try {
        const raw = fs.readFileSync(sessionFilePath, 'utf8');
        return normalizeStoredSession(JSON.parse(raw), entry.name);
      } catch {
        return null;
      }
    })
    .filter((session): session is SessionSettings => Boolean(session));
}

export function getSessionById(sessionId: string): SessionSettings | null {
  const sessionFilePath = getSessionFilePath(sessionId);
  if (!fs.existsSync(sessionFilePath)) return null;

  try {
    const raw = fs.readFileSync(sessionFilePath, 'utf8');
    return normalizeStoredSession(JSON.parse(raw), sessionId);
  } catch {
    return null;
  }
}

export function saveSessionById(sessionId: string, session: SessionSettings): SessionSettings {
  const nextSession = normalizeStoredSession(session, sessionId);
  const sessionDirectory = getSessionDirectory(sessionId);
  fs.mkdirSync(sessionDirectory, { recursive: true });
  fs.writeFileSync(getSessionFilePath(sessionId), JSON.stringify(nextSession, null, 2), 'utf8');
  return nextSession;
}

export function CreateSession(session: SessionSettings = DEFAULT_SESSION): SessionSettings {
  const homeSession = loadSession();
  const sessionId = randomUUID();
  const now = new Date().toISOString();

  return saveSessionById(sessionId, {
    ...DEFAULT_SESSION,
    ...homeSession,
    ...session,
    sessionId,
    title: null,
    summaryText: null,
    createdDate: now,
    lastOpenedDate: now,
  });
}

export function SetSession(sessionId: string): SessionSettings | null {
  const session = getSessionById(sessionId);
  if (!session) return null;

  const now = new Date().toISOString();
  const updated = saveSessionById(sessionId, { ...session, lastOpenedDate: now });

  saveSession(updated);
  return updated;
}
