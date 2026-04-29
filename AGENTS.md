# Agent Guide

This file gives future AI agents project context before they edit OpenStudy. Read it before making changes.

## Project Purpose

OpenStudy is an AI-powered study assistant that runs in the terminal. It is an OpenCode-inspired TUI focused on lightweight study sessions, guided prompts, subject selection, model selection, reasoning controls, study material, and study language settings.

The intended experience is local-first, keyboard-driven, calm, and focused. Users should be able to open the CLI, say `Hi`, and let the selected model guide them.

## Current Product Direction

- Keep the app centered on studying, not general software-agent workflows.
- Preserve the terminal-native feel. Avoid web-app concepts that do not map cleanly to Ink.
- Favor fast keyboard shortcuts and visible controls over hidden flows.
- Keep onboarding simple. First launch should guide users into setup without clutter.
- Keep settings local under `~/.openstudy` unless a future requirement explicitly changes this.
- Avoid noisy UI. The current visual language is black background, compact centered layout, amber accents, dim secondary text, and minimal status information.

## Design Direction

- The home screen should stay visually focused around the logo and prompt input.
- The prompt placeholder should stay friendly and model-aware: users who do not know what to ask should be invited to say `Hi`.
- The bottom status bar should remain quiet and low-contrast.
- Modal interactions should feel consistent: keyboard-first, readable, and easy to dismiss.
- Respect the current minimum terminal size behavior instead of trying to squeeze the UI into unusable dimensions.
- For new UI, follow existing Ink patterns in `src/components` and `src/modals` before introducing new abstractions.

## Architecture Overview

- `src/index.tsx`: app entrypoint, loading orchestration, alternate-screen render.
- `src/components`: primary reusable Ink UI components.
- `src/components/HomeScreen.tsx`: main screen, keyboard bindings, modal triggers, prompt configuration, terminal sizing.
- `src/components/SetupScreen.tsx`: first-run/setup flow for provider configuration.
- `src/modals`: modal modules and manifests. Each modal should have a manifest when it is user-triggerable.
- `src/commands`: slash command modules loaded dynamically by `loadCommands`.
- `src/providers`: provider implementations and provider definitions.
- `src/options`: static options such as study subjects.
- `src/utils/config.ts`: local config/session persistence under `~/.openstudy`.
- `dist`: generated build output and ignored by git. Do not edit or commit it unless project policy changes.

## Current Controls

- `tab`: subject selector.
- `ctrl+m`: model selector.
- `ctrl+r`: reasoning selector.
- `ctrl+f`: material picker.
- `ctrl+l`: study language selector.
- `ctrl+c`: exit or close an active modal.
- `/setup`: setup flow.
- `/exit`: exit the CLI.

## Development Workflow

- Package manager: `npm`.
- Development command: `npm run dev`.
- Build command: `npm run build`.
- Start compiled app: `npm start`.
- Reset local config: `npm run reset`.
- TypeScript is strict and uses ES modules.
- Prefer small, direct changes over broad rewrites.
- Run `npm run build` after TypeScript or behavior changes when feasible.
- Documentation-only changes do not require a build unless package metadata or generated outputs are touched.

## Coding Protocols

- Treat `src` as the source of truth.
- Do not manually edit generated files in `dist`.
- Preserve existing keyboard shortcuts unless explicitly asked to change them.
- When adding a modal, add or update its manifest so it can be discovered consistently.
- When adding a slash command, follow the module shape in `src/commands/types.ts`.
- Keep provider additions behind provider definitions in `src/providers` and compatible session/config types.
- Do not introduce API keys, secrets, or local user config into the repository.
- Do not change license or contribution policy casually. Ask first if the task touches legal terms.

## Repository Policy

- External contributions are currently not accepted.
- Users may fork under the Open ICL License 1.0.0 terms.
- Forks must use a different project name and keep corresponding source publicly available when redistributed.
- Internal use is allowed, including by companies and other for-profit organizations.
- Selling the software, selling modified versions, paid distribution, or paid hosted access requires written permission from the project owner.

## Agent Behavior Expectations

- Build context by reading relevant files before editing.
- Prefer minimal, correct patches.
- Keep the README, license, package metadata, and app behavior consistent when touching project-level policy.
- Do not commit or push unless the user explicitly asks.
- If the worktree has unrelated changes, leave them alone.
- If a requested change conflicts with the license, contribution policy, or design direction, stop and ask a concise clarifying question.
