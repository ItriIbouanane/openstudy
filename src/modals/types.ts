import type React from 'react';
import type { useInput } from 'ink';
import type { SubjectOption } from '../options/index.js';
import type { Config, Provider, SessionSettings } from '../types/index.js';

export interface SelectedModel {
  provider: Provider;
  name: string;
}

export type ModalScreen = 'home' | 'session';

export interface ModalState {
  id: string;
  [key: string]: unknown;
}

export type ModalInputKey = Parameters<Parameters<typeof useInput>[0]>[1];

export interface ModalTrigger {
  id: string;
  key: string;
  label: string;
  description: string;
  input?: string;
  ctrl?: boolean;
  tab?: boolean;
}

export interface ModalContext {
  session: SessionSettings;
  activeSessionId: string | null;
  config: Config | null;
  selectedSubject: SubjectOption | null;
  selectedModel: SelectedModel | null;
  openModal: (id: string, initialState?: Record<string, unknown>) => void | Promise<void>;
  closeModal: () => void;
  updateModal: (updater: ModalState | ((current: ModalState) => ModalState)) => void;
  updateSettings: (patch: Partial<SessionSettings>) => SessionSettings;
  setSession: (sessionId: string) => SessionSettings | null;
}

export interface ModalModule {
  open: (context: ModalContext, initialState?: Record<string, unknown>) => ModalState | null | Promise<ModalState | null>;
  getHeight: (modal: ModalState) => number;
  render: (props: ModalRenderProps) => React.ReactNode;
  handleInput?: (props: ModalInputProps) => boolean;
}

export interface ModalManifest {
  id: string;
  Screen: ModalScreen | null;
  trigger?: ModalTrigger;
  load: () => Promise<ModalModule>;
}

export interface ModalRenderContext extends ModalContext {
  isProviderConfigured: (provider: Provider) => boolean;
}

export interface ModalRenderProps {
  modal: ModalState;
  context: ModalRenderContext;
}

export interface ModalInputProps {
  input: string;
  key: ModalInputKey;
  modal: ModalState;
  context: ModalRenderContext;
}

export interface ActiveModal {
  id: string;
  module: ModalModule;
  state: ModalState;
}
