import path from 'path';
import { createOpencode } from '@opencode-ai/sdk/v2';
import type { AIProvider, ProviderModelOption, ProviderPromptFile, ProviderPromptOptions, ProviderPromptStreamEvent } from './types.js';

type OpenCodeInstance = Awaited<ReturnType<typeof createOpencode>>;

const OPENCODE_PORTS = [5678, 8754];

const OPENCODE_CONFIG = {
  compaction: { auto: false },
  agent: {
    compaction: { disable: true },
    // Custom toolless agent used for all OpenStudy prompts.
    // "permission: deny" means no tools are registered, so the model
    // gets a minimal system prompt without any tool definitions —
    // preventing context overflow even on models with small context windows.
    study: {
      mode: 'primary' as const,
      description: 'Tool-free study assistant for OpenStudy',
    },
  },
};

let _instance: OpenCodeInstance | null = null;
let _initPromise: Promise<OpenCodeInstance> | null = null;

async function getOrCreateOpencode(): Promise<OpenCodeInstance> {
  if (_instance) return _instance;
  if (!_initPromise) {
    _initPromise = (async (): Promise<OpenCodeInstance> => {
      let lastError: unknown;
      for (const port of OPENCODE_PORTS) {
        try {
          return await createOpencode({ port, config: OPENCODE_CONFIG });
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError;
    })()
      .then(inst => {
        _instance = inst;
        return inst;
      })
      .catch(err => {
        _initPromise = null;
        throw err;
      });
  }
  return _initPromise;
}

export const OPENCODE_LOGIN_REQUIRED_MESSAGE = [
  'Could not connect to the OpenCode server.',
  'Make sure the opencode CLI is installed and at least one provider is configured, then try again.',
].join(' ');

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';

function createAbortError(): Error {
  const error = new Error('OpenCode prompt aborted.');
  error.name = 'AbortError';
  return error;
}

// Populated dynamically after CheckLoginStatus() via client.provider.list().
// Falls back to empty until the first successful auth check.
let _cachedModels: ProviderModelOption[] | null = null;

async function fetchAndCacheModels(client: OpenCodeInstance['client']): Promise<void> {
  try {
    const result = await client.provider.list();
    if (!result.data) return;

    const { all, connected } = result.data;
    const options: ProviderModelOption[] = [];

    for (const provider of all) {
      if (!connected.includes(provider.id)) continue;
      for (const [modelId, model] of Object.entries(provider.models)) {
        const id = `${provider.id}/${modelId}`;
        options.push({
          id,
          label: `${model.name} (${provider.name})`,
          model: id,
          reasoningLevels: [],
          group: { id: provider.id, name: provider.name },
        });
      }
    }

    if (options.length > 0) {
      _cachedModels = options;
    }
  } catch {
    // Non-fatal; GetModels() will return [] until the next successful CheckLoginStatus()
  }
}

// Still exported for consumers that need a static reference before auth completes.
export const OPENCODE_MODEL_OPTIONS: ProviderModelOption[] = [];
export const OPENCODE_MODELS: string[] = [];

export class OpenCodeProvider implements AIProvider {
  readonly id = 'opencode';
  readonly label = 'OpenCode';

  async CheckLoginStatus(): Promise<boolean> {
    let inst: OpenCodeInstance;
    try {
      inst = await getOrCreateOpencode();
    } catch {
      throw new Error(OPENCODE_LOGIN_REQUIRED_MESSAGE);
    }
    const health = await inst.client.global.health();
    if (!health.data?.healthy) {
      throw new Error(OPENCODE_LOGIN_REQUIRED_MESSAGE);
    }
    await fetchAndCacheModels(inst.client);
    return true;
  }

  GetModels(): ProviderModelOption[] {
    return _cachedModels ?? [];
  }

  async *Prompt(input: string, options: ProviderPromptOptions = {}): AsyncGenerator<ProviderPromptStreamEvent> {
    yield { type: 'status', text: 'Checking login' };

    let inst: OpenCodeInstance;
    try {
      inst = await getOrCreateOpencode();
    } catch {
      throw new Error(OPENCODE_LOGIN_REQUIRED_MESSAGE);
    }
    const { client } = inst;

    // Parse "providerID/modelID" format
    const modelStr = options.model ?? DEFAULT_MODEL;
    const slashIdx = modelStr.indexOf('/');
    const providerID = slashIdx >= 0 ? modelStr.slice(0, slashIdx) : 'anthropic';
    const modelID = slashIdx >= 0 ? modelStr.slice(slashIdx + 1) : modelStr;

    // Pass file paths to the model and instruct it to read them directly
    const files = [options.file, ...(options.files ?? [])]
      .filter((f): f is ProviderPromptFile => Boolean(f));
    let fullInput = input;
    if (files.length > 0) {
      const fileLines: string[] = [];
      for (const f of files) {
        const filePath = typeof f === 'string' ? f : f.path;
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
          fileLines.push(`- URL: ${filePath}`);
        } else {
          fileLines.push(`- Local file: ${path.resolve(filePath)}`);
        }
      }
      fullInput = [
        input,
        '',
        'Use the attached study material as the only source of truth.',
        ...fileLines,
        'Read the referenced material directly before answering.',
      ].join('\n');
    }

    yield { type: 'status', text: 'Starting session' };

    let sessionId: string | null = null;
    let eventSub: Awaited<ReturnType<typeof client.event.subscribe>> | null = null;
    let promptPromise: ReturnType<typeof client.session.prompt> | null = null;

    const isStructured = Boolean(options.responseSchema);
    let hasResponse = false;
    let responseText = '';

    try {
      // Create a new OpenCode session per prompt call
      const sessionResult = await client.session.create({
        directory: options.workingDirectory ?? process.cwd(),
        title: 'OpenStudy',
      });
      if (!sessionResult.data) throw new Error('Failed to create OpenCode session');
      sessionId = sessionResult.data.id;

      // Subscribe to the global event stream
      eventSub = await client.event.subscribe();

      // Fire prompt without awaiting so we can stream events concurrently.
      // Note: responseSchema is intentionally NOT passed as a native format —
      // OpenCode suppresses text delta streaming when json_schema format is active,
      // so we rely on the model following the JSON instructions in the user prompt instead.
      promptPromise = client.session.prompt({
        sessionID: sessionId,
        parts: [{ type: 'text', text: fullInput }],
        model: { providerID, modelID },
        agent: 'study',
        ...(options.system ? { system: options.system } : {}),
      });

      yield { type: 'status', text: isStructured ? 'Waiting for structured response' : 'Waiting for response' };

      // Process SSE event stream
      for await (const event of eventSub.stream) {
        if (options.signal?.aborted) throw createAbortError();

        if (event.type === 'session.next.text.delta') {
          if (event.properties.sessionID !== sessionId) continue;
          hasResponse = true;
          responseText += event.properties.delta;
          yield { type: 'response', text: responseText };
        } else if (event.type === 'session.next.reasoning.started') {
          if (event.properties.sessionID !== sessionId) continue;
          if (!hasResponse) yield { type: 'status', text: 'Analyzing key ideas' };
        } else if (event.type === 'session.error') {
          if (event.properties.sessionID !== sessionId) continue;
          const err = event.properties.error as Record<string, unknown> | undefined;
          const errName = typeof err?.name === 'string' ? err.name : '';
          const errData = err?.data && typeof err.data === 'object' ? err.data as Record<string, unknown> : null;
          const rawMsg = typeof errData?.message === 'string' ? errData.message : errName;
          const isContextOverflow = errName === 'ContextOverflowError' || /context|token.*limit|prompt token/i.test(rawMsg);
          throw new Error(isContextOverflow
            ? 'The study material is too large for this model\'s context window. Try a model with a larger context limit, or use a shorter document.'
            : rawMsg || 'An error occurred during the session.');
        } else if (event.type === 'message.updated') {
          if (event.properties.sessionID !== sessionId) continue;
          const msg = event.properties.info;
          if (msg.role === 'assistant' && msg.error) {
            const errData = 'data' in msg.error
              ? (msg.error.data as Record<string, unknown>)
              : null;
            const rawMsg = errData?.message
              ? String(errData.message)
              : msg.error.name;
            const isContextOverflow = /context|token.*limit|prompt token/i.test(rawMsg);
            const errMsg = isContextOverflow
              ? 'The study material is too large for this model\'s context window. Try a model with a larger context limit, or use a shorter document.'
              : rawMsg;
            throw new Error(errMsg);
          }
        } else if (event.type === 'session.idle') {
          if (event.properties.sessionID === sessionId) break;
        }
      }

      // Await the final prompt result (ignore errors — response already streamed via text deltas)
      await promptPromise.catch(() => null);

      // For structured output, re-yield the final accumulated text so SessionScreen
      // gets a clean terminal response event after streaming completes.
      if (isStructured && responseText) {
        yield { type: 'response', text: responseText };
      }
    } finally {
      if (options.signal?.aborted && sessionId) {
        await client.session.abort({ sessionID: sessionId }).catch(() => null);
      }
      if (promptPromise) {
        await promptPromise.catch(() => null);
      }
      if (eventSub) {
        await eventSub.stream.return(undefined).catch(() => undefined);
      }
      if (sessionId) {
        await client.session.delete({ sessionID: sessionId }).catch(() => null);
      }
    }
  }
}

export async function closeOpenCodeProvider(): Promise<void> {
  if (_instance) {
    _instance.server.close();
    _instance = null;
    _initPromise = null;
  }
}
