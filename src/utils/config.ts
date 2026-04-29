import fs from 'fs';
import path from 'path';
import os from 'os';
import { subjects } from '../options/index.js';
import { PROVIDERS, type Config, type Provider, type SessionSettings } from '../types/index.js';

const CONFIG_DIR  = path.join(os.homedir(), '.openstudy');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');

const DEFAULT_SESSION: SessionSettings = {
  provider: null,
  apiKey: '',
  subject: subjects.find(subject => subject.default)?.name ?? subjects[0]?.name ?? 'General',
  modelProvider: null,
  model: null,
  reasoningEffort: 'Reasoning effort',
  material: 'Material',
  studyLanguage: 'Study Language',
};

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && PROVIDERS.some(provider => provider.id === value);
}

function normalizeSession(value: unknown): SessionSettings {
  const raw = value && typeof value === 'object' ? value as Partial<SessionSettings> : {};
  const subject = typeof raw.subject === 'string' && raw.subject.trim().length > 0
    ? raw.subject
    : DEFAULT_SESSION.subject;

  return {
    provider: isProvider(raw.provider) ? raw.provider : DEFAULT_SESSION.provider,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : DEFAULT_SESSION.apiKey,
    subject,
    modelProvider: isProvider(raw.modelProvider) ? raw.modelProvider : DEFAULT_SESSION.modelProvider,
    model: typeof raw.model === 'string' && raw.model.trim().length > 0 ? raw.model : DEFAULT_SESSION.model,
    reasoningEffort: typeof raw.reasoningEffort === 'string' ? raw.reasoningEffort : DEFAULT_SESSION.reasoningEffort,
    material: typeof raw.material === 'string' ? raw.material : DEFAULT_SESSION.material,
    studyLanguage: typeof raw.studyLanguage === 'string' ? raw.studyLanguage : DEFAULT_SESSION.studyLanguage,
  };
}

function readConfigFile(): Config | null {
  if (!configExists()) return null;

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(raw) as Config;
    if (!isProvider(config.provider) || typeof config.apiKey !== 'string') return null;
    return config;
  } catch {
    return null;
  }
}

export function loadSession(): SessionSettings {
  ensureConfigDir();

  if (!fs.existsSync(SESSION_FILE)) {
    const legacyConfig = readConfigFile();
    const session = legacyConfig
      ? { ...DEFAULT_SESSION, provider: legacyConfig.provider, apiKey: legacyConfig.apiKey }
      : DEFAULT_SESSION;

    saveSession(session);
    return session;
  }

  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf8');
    const session = normalizeSession(JSON.parse(raw));
    saveSession(session);
    return session;
  } catch {
    saveSession(DEFAULT_SESSION);
    return DEFAULT_SESSION;
  }
}

export function saveSession(session: SessionSettings): void {
  ensureConfigDir();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf8');
}

export function updateSettings(patch: Partial<SessionSettings>): SessionSettings {
  const next = { ...loadSession(), ...patch };
  saveSession(next);
  return next;
}

export const UpdateSettings = updateSettings;

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function loadConfig(): Config | null {
  const session = loadSession();
  if (session.provider) return { provider: session.provider, apiKey: session.apiKey };

  return readConfigFile();
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');

  const session = loadSession();
  saveSession({ ...session, provider: config.provider, apiKey: config.apiKey });
}

export { CONFIG_FILE, CONFIG_DIR, SESSION_FILE };
