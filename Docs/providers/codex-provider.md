# Codex Provider

`CodexProvider` wraps the OpenAI Codex SDK and exposes the shared `AIProvider` interface used by OpenStudy providers.

## Import

```ts
import { CodexProvider } from '../src/providers/codex.js';
```

Provider discovery is available from the provider index.

```ts
import { createProvider, getAvailableProviders } from '../src/providers/index.js';

const available = getAvailableProviders();
const provider = createProvider('codex');
```

## Basic Usage

```ts
const provider = new CodexProvider();

await provider.login();

const result = await provider.prompt('Explain recursion with a short example.');

console.log(result.text);
console.log(result.threadId);
```

## Continue A Thread

Pass the returned `threadId` back into `prompt()` to continue the same Codex conversation.

```ts
const first = await provider.prompt('Help me plan a study session about photosynthesis.');

const second = await provider.prompt('Turn that into a quiz.', {
  threadId: first.threadId ?? undefined,
});
```

## Options

`prompt()` accepts `CodexPromptOptions`, which extends the base provider options.

```ts
await provider.prompt('Review this workspace and suggest next steps.', {
  model: 'gpt-5.5',
  workingDirectory: process.cwd(),
  reasoningEffort: 'medium',
  sandboxMode: 'read-only',
  approvalPolicy: 'on-request',
  networkAccessEnabled: false,
  webSearchMode: 'disabled',
});
```

## Model Options

Use `GetModelOptions()` when a caller needs selectable model rows. Each model option includes the exact model id accepted by the Codex SDK and the reasoning levels available for that specific model.

```ts
const options = provider.GetModelOptions();
const option = options[0];
const reasoning = option?.reasoningLevels.find(level => level.value === 'medium');

await provider.prompt('Explain this topic.', {
  model: option?.model,
  reasoningEffort: reasoning?.value as never,
});
```

`GetModelsList()` returns the unique Codex model ids, such as `gpt-5.5` and `gpt-5.4`.

## Default Safety Settings

The provider currently starts Codex threads with assisted, conservative defaults:

- `sandboxMode: 'read-only'`
- `approvalPolicy: 'on-request'`
- `networkAccessEnabled: false`
- `webSearchMode: 'disabled'`
- `skipGitRepoCheck: true`

Callers can override these values through `CodexPromptOptions` when a workflow needs more access.

## Streaming

Use `streamPrompt()` when the caller needs raw Codex thread events.

```ts
for await (const event of provider.streamPrompt('Inspect the current project.')) {
  console.log(event);
}
```

## Authentication

`login()` and `prompt()` call `CheckAuth()`, which checks the local Codex login state. If Codex is not authenticated, the provider throws `CODEX_LOGIN_REQUIRED_MESSAGE`.

Authenticate outside OpenStudy with:

```bash
codex login
```
