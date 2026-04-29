# OpenStudy

OpenStudy is an AI-powered study assistant that runs in your terminal. It is built as an OpenCode-inspired TUI for asking study questions, selecting a subject, choosing a model, adjusting reasoning effort, attaching study material, and working in a preferred study language without leaving the command line.

The project is currently focused on a local-first CLI experience using React, Ink, TypeScript, and the Codex SDK.

## Purpose

OpenStudy is designed to make AI-guided studying fast and lightweight. Instead of opening a browser or switching tools, you can launch a terminal interface, choose the context for your study session, and start with a simple prompt such as `Hi`.

Current goals:

- Provide a focused terminal UI for study sessions.
- Let users switch study subjects from the keyboard.
- Let users select the AI model used for guidance.
- Support reasoning-effort, material, and language controls.
- Keep local session settings in the user's home directory.

## Features

- Terminal UI built with Ink and React.
- First-launch setup flow.
- Codex provider support.
- Subject selector with `tab`.
- Model selector with `ctrl+m`.
- Reasoning selector with `ctrl+r`.
- Material picker with `ctrl+f`.
- Study language selector with `ctrl+l`.
- Slash commands, including `/setup` and `/exit`.
- Local config and session storage in `~/.openstudy`.

## Requirements

- Node.js 20 or newer is recommended.
- npm.
- A terminal large enough for the TUI. The current minimum is `73x23`.
- Codex login/configuration available locally, if you want to use the Codex provider.

## Local Setup

Clone the repository:

```bash
git clone <repo-url>
cd openstudy
```

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Run the compiled CLI:

```bash
npm start
```

Reset local OpenStudy config:

```bash
npm run reset
```

## Usage

Start OpenStudy, then use the prompt at the center of the screen. If you are not sure what to ask, say `Hi` and the selected model will guide you.

Keyboard shortcuts:

- `tab`: choose a subject.
- `ctrl+m`: choose a model.
- `ctrl+r`: choose reasoning effort.
- `ctrl+f`: choose study material.
- `ctrl+l`: choose study language.
- `ctrl+c`: exit or close an active modal.

Slash commands:

- `/setup`: open the setup flow.
- `/exit`: exit the CLI.

## Configuration

OpenStudy stores local settings under:

```text
~/.openstudy
```

Important files:

- `config.json`: provider configuration.
- `session.json`: current subject, model, reasoning effort, material, and study language.

## Development Scripts

- `npm run dev`: run the TypeScript source with `tsx`.
- `npm run build`: compile TypeScript into `dist`.
- `npm start`: run `dist/index.js`.
- `npm run reset`: remove/reset local OpenStudy configuration.

## Contributions

OpenStudy is not accepting external contributions at this time.

Users may still fork the project, as long as the fork follows the project license and policy:

- The fork must use a different project name and must not be distributed as `OpenStudy`.
- The fork must remain publicly source-available.
- The fork must preserve copyright notices and license terms.
- Internal use is allowed, including internal use by companies and other for-profit organizations.
- Selling the software, selling modified versions, paid distribution, or paid hosted access requires written permission from the project owner.

## License

OpenStudy is licensed under the Open ICL License 1.0.0. See `LICENSE` for the full terms.

This is a source-available, sale-restricted software license. It permits use, including internal business use, forking, modification, and redistribution under the same license, provided redistributed forks use a different name and keep their complete corresponding source publicly available.

This license is not OSI-approved open source because restrictions on selling and paid access are not compatible with the Open Source Definition.
