import { spawn } from 'child_process';
import path from 'path';
import { createRequire } from 'module';
import { Codex, type ApprovalMode, type Input, type ModelReasoningEffort, type SandboxMode, type ThreadEvent, type ThreadOptions, type TurnOptions, type WebSearchMode } from '@openai/codex-sdk';
import type { AIProvider, ProviderModelOption, ProviderPromptFile, ProviderPromptOptions, ProviderPromptResult, ProviderReasoningLevel } from './types.js';

const require = createRequire(import.meta.url);
const CODEX_CLI_PATH = path.join(path.dirname(require.resolve('@openai/codex/package.json')), 'bin', 'codex.js');

export const CODEX_MODEL_OPTIONS: ProviderModelOption[] = [
  {
    id: 'gpt-5.5',
    label: 'gpt-5.5',
    model: 'gpt-5.5',
    reasoningLevels: [
      { id: 'minimal', label: 'Minimal', value: 'minimal' satisfies ModelReasoningEffort },
      { id: 'low', label: 'Low', value: 'low' satisfies ModelReasoningEffort },
      { id: 'medium', label: 'Medium', value: 'medium' satisfies ModelReasoningEffort },
      { id: 'high', label: 'High', value: 'high' satisfies ModelReasoningEffort },
      { id: 'xhigh', label: 'xHigh', value: 'xhigh' satisfies ModelReasoningEffort },
    ],
  },
  {
    id: 'gpt-5.4',
    label: 'gpt-5.4',
    model: 'gpt-5.4',
    reasoningLevels: [
      { id: 'minimal', label: 'Minimal', value: 'minimal' satisfies ModelReasoningEffort },
      { id: 'low', label: 'Low', value: 'low' satisfies ModelReasoningEffort },
      { id: 'medium', label: 'Medium', value: 'medium' satisfies ModelReasoningEffort },
      { id: 'high', label: 'High', value: 'high' satisfies ModelReasoningEffort },
     
    ],
  },
];

export const CODEX_MODELS = CODEX_MODEL_OPTIONS.map(option => option.model);

const DEFAULT_THREAD_OPTIONS: Required<Pick<ThreadOptions,
  'approvalPolicy' |
  'networkAccessEnabled' |
  'sandboxMode' |
  'skipGitRepoCheck' |
  'webSearchMode'
>> = {
  approvalPolicy: 'on-request',
  networkAccessEnabled: false,
  sandboxMode: 'read-only',
  skipGitRepoCheck: true,
  webSearchMode: 'disabled',
};

export const CODEX_LOGIN_REQUIRED_MESSAGE = [
  'Codex is not logged in on this machine.',
  'Please exit this program and run `codex login` in a terminal window, then come back.',
].join(' ');

export interface CodexPromptOptions extends ProviderPromptOptions {
  reasoningEffort?: ModelReasoningEffort;
  sandboxMode?: SandboxMode;
  approvalPolicy?: ApprovalMode;
  networkAccessEnabled?: boolean;
  webSearchMode?: WebSearchMode;
  skipGitRepoCheck?: boolean;
}

export class CodexProvider implements AIProvider {
  readonly id = 'codex';
  readonly label = 'Codex';

  private client: Codex | null = null;

  async login(): Promise<void> {
    await this.CheckAuth();
    this.client = new Codex();
  }

  async CheckAuth(): Promise<boolean> {
    const result = await this.runCodexLoginStatus();
    if (result.exitCode === 0) return true;

    throw new Error(CODEX_LOGIN_REQUIRED_MESSAGE);
  }

  GetModelsList(): string[] {
    return [...CODEX_MODELS];
  }

  GetModelOptions(): ProviderModelOption[] {
    return CODEX_MODEL_OPTIONS.map(option => ({
      ...option,
      reasoningLevels: option.reasoningLevels.map(level => ({ ...level })),
    }));
  }

  async prompt(input: Input, options: CodexPromptOptions = {}): Promise<ProviderPromptResult> {
    await this.CheckAuth();

    const client = this.getClient();
    const thread = this.createThread(client, options);

    try {
      const result = await thread.run(this.promptInput(input, options), this.turnOptions(options));

      return {
        text: result.finalResponse,
        threadId: thread.id,
        raw: result,
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async *streamPrompt(input: Input, options: CodexPromptOptions = {}): AsyncGenerator<ThreadEvent> {
    await this.CheckAuth();

    const client = this.getClient();
    const thread = this.createThread(client, options);

    try {
      const { events } = await thread.runStreamed(this.promptInput(input, options), this.turnOptions(options));

      for await (const event of events) {
        yield event;
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private getClient(): Codex {
    this.client ??= new Codex();
    return this.client;
  }

  private createThread(client: Codex, options: CodexPromptOptions) {
    const threadOptions = this.threadOptions(options);

    return options.threadId
      ? client.resumeThread(options.threadId, threadOptions)
      : client.startThread(threadOptions);
  }

  private threadOptions(options: CodexPromptOptions): ThreadOptions {
    return {
      model: options.model,
      workingDirectory: options.workingDirectory ?? process.cwd(),
      skipGitRepoCheck: options.skipGitRepoCheck ?? DEFAULT_THREAD_OPTIONS.skipGitRepoCheck,
      modelReasoningEffort: options.reasoningEffort,
      sandboxMode: options.sandboxMode ?? DEFAULT_THREAD_OPTIONS.sandboxMode,
      approvalPolicy: options.approvalPolicy ?? DEFAULT_THREAD_OPTIONS.approvalPolicy,
      networkAccessEnabled: options.networkAccessEnabled ?? DEFAULT_THREAD_OPTIONS.networkAccessEnabled,
      webSearchMode: options.webSearchMode ?? DEFAULT_THREAD_OPTIONS.webSearchMode,
    };
  }

  private turnOptions(options: CodexPromptOptions): TurnOptions {
    return {
      signal: options.signal,
      outputSchema: options.responseSchema,
    };
  }

  private promptInput(input: Input, options: CodexPromptOptions): Input {
    const files = this.promptFiles(options);
    if (files.length === 0) return input;

    const fileInputs = files.map(file => ({ type: 'local_image' as const, path: file.path }));
    if (typeof input === 'string') return [{ type: 'text', text: input }, ...fileInputs];

    return [...input, ...fileInputs];
  }

  private promptFiles(options: CodexPromptOptions): Array<{ path: string }> {
    const files = [options.file, ...(options.files ?? [])].filter((file): file is ProviderPromptFile => Boolean(file));

    return files.map(file => typeof file === 'string' ? { path: file } : file);
  }

  private normalizeError(error: unknown): Error {
    if (!this.looksLikeAuthError(error)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    return new Error(CODEX_LOGIN_REQUIRED_MESSAGE);
  }

  private looksLikeAuthError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /auth|login|sign\s*in|api key|not authenticated|unauthorized|401/i.test(message);
  }

  private runCodexLoginStatus(): Promise<{ exitCode: number | null; output: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [CODEX_CLI_PATH, 'login', 'status'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      child.stdout.on('data', chunk => {
        output += String(chunk);
      });
      child.stderr.on('data', chunk => {
        output += String(chunk);
      });
      child.on('error', reject);
      child.on('close', exitCode => {
        resolve({ exitCode, output });
      });
    });
  }
}
