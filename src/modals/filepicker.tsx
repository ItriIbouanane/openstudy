import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import React from 'react';
import { Box, Text } from 'ink';
import { focusTextColor } from '../utils/index.js';
import { createHandleInput, isBackspace, isCancel, isPlainTextInput, isSubmit } from './input.js';
import type { ModalContext, ModalInputProps, ModalRenderProps, ModalState } from './types.js';

const FILE_PICKER_MAX_ROWS = 10;
const HOME_DIR = path.resolve(os.homedir());
const DOCUMENTS_DIR = path.join(HOME_DIR, '.openstudy', 'documents');
const SOURCE_OPTIONS = [
  { id: 'computer', label: 'Material from computer', description: 'Choose a local document' },
  { id: 'url', label: 'Material from URL', description: 'Download a document from the web' },
] as const;
const DOCUMENT_EXTENSIONS = new Set([
  '.csv',
  '.doc',
  '.docx',
  '.epub',
  '.json',
  '.md',
  '.markdown',
  '.odp',
  '.ods',
  '.odt',
  '.pdf',
  '.ppt',
  '.pptx',
  '.rtf',
  '.tex',
  '.tsv',
  '.txt',
  '.xls',
  '.xlsx',
  '.xml',
  '.yaml',
  '.yml',
]);

interface FilePickerEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
}

type FilePickerModalState =
  | { id: 'filepicker'; layer: 'source'; selected: number; error?: string }
  | { id: 'filepicker'; layer: 'browser'; cwd: string; entries: FilePickerEntry[]; selected: number; error?: string }
  | { id: 'filepicker'; layer: 'url'; url: string; downloading: boolean; error?: string };

export function open(_context: ModalContext): ModalState {
  return { id: 'filepicker', layer: 'source', selected: 0 };
}

export function getHeight(modal: ModalState) {
  const state = modal as FilePickerModalState;
  if (state.layer === 'source') return SOURCE_OPTIONS.length + 7;
  if (state.layer === 'url') return 8;

  const rows = Math.max(1, Math.min(FILE_PICKER_MAX_ROWS, state.entries.length));
  return rows + 8;
}

export function render(props: ModalRenderProps) {
  const state = props.modal as FilePickerModalState;

  if (state.layer === 'source') return <SourceLayer {...props} modal={state} />;
  if (state.layer === 'url') return <UrlLayer modal={state} />;
  return <BrowserLayer {...props} modal={state} />;
}

function SourceLayer({ modal, context }: ModalRenderProps & { modal: Extract<FilePickerModalState, { layer: 'source' }> }) {
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Add Material</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Choose where your document comes from.</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {SOURCE_OPTIONS.map((option, index) => {
          const isSelected = modal.selected === index;

          return (
            <Box key={option.id} backgroundColor={isSelected ? subjectColor : undefined} justifyContent="space-between">
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{option.label}</Text>
              <Text color={isSelected ? '#000000' : '#777777'}>{option.description}</Text>
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color={modal.error ? '#ef4444' : '#777777'}>{modal.error ?? '↑↓ move'}</Text>
        <Text color="#777777">enter continue</Text>
      </Box>
    </>
  );
}

function UrlLayer({ modal }: { modal: Extract<FilePickerModalState, { layer: 'url' }> }) {
  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Material URL</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">Enter a direct document URL. Use ctrl+v to paste from clipboard.</Text>
      </Box>
      <Box backgroundColor="#1f1f23" paddingX={1} marginBottom={1}>
        <Text color={modal.url ? '#f0f0f0' : '#777777'}>{modal.url || 'https://example.com/document.pdf'}</Text>
        {!modal.downloading && <Text color="#f0a500">█</Text>}
      </Box>
      <Box justifyContent="space-between">
        <Text color={modal.error ? '#ef4444' : '#777777'}>{modal.error ? truncateError(modal.error) : '← sources'}</Text>
        <Text color="#777777">{modal.downloading ? 'downloading...' : 'enter download'}</Text>
      </Box>
    </>
  );
}

function BrowserLayer({ modal, context }: ModalRenderProps & { modal: Extract<FilePickerModalState, { layer: 'browser' }> }) {
  const state = modal;
  const subjectColor = context.selectedSubject?.color ?? '#3b82f6';
  const rows = Math.max(1, Math.min(FILE_PICKER_MAX_ROWS, state.entries.length));
  const windowStart = Math.min(
    Math.max(0, state.selected - rows + 1),
    Math.max(0, state.entries.length - rows),
  );
  const visibleEntries = state.entries.slice(windowStart, windowStart + rows);

  return (
    <>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color="#f0f0f0" bold>Select Material</Text>
        <Text color="#777777">esc</Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="#777777">{shortenPath(state.cwd)}</Text>
      </Box>
      <Box flexDirection="column" marginBottom={1}>
        {visibleEntries.length === 0 ? (
          <Text color="#777777">No documents found</Text>
        ) : visibleEntries.map((entry, index) => {
          const entryIndex = windowStart + index;
          const isSelected = state.selected === entryIndex;
          const iconColor = entry.type === 'directory' ? subjectColor : '#888888';

          return (
            <Box key={entry.path} backgroundColor={isSelected ? subjectColor : undefined} justifyContent="space-between">
              <Text color={focusTextColor(iconColor, subjectColor, isSelected)} bold={isSelected}>{entry.type === 'directory' ? '▸ ' : '  '}</Text>
              <Text color={isSelected ? '#000000' : '#f0f0f0'} bold={isSelected}>{entry.name}</Text>
              <Text color={isSelected ? '#000000' : '#777777'}>{entry.type === 'directory' ? 'dir' : 'file'}</Text>
            </Box>
          );
        })}
      </Box>
      <Box justifyContent="space-between">
        <Text color={state.error ? '#ef4444' : '#777777'}>{state.error ? truncateError(state.error) : state.cwd === HOME_DIR ? '← sources' : '← parent'}</Text>
        <Text color="#777777">enter open/select</Text>
      </Box>
      <Box justifyContent="flex-end">
        <Text color="#777777">{windowStart + 1}-{windowStart + visibleEntries.length}/{state.entries.length}</Text>
      </Box>
    </>
  );
}

export const handleInput = createHandleInput([
  {
    when: isCancel,
    run: ({ context }) => context.closeModal(),
  },
  {
    when: props => isSourceLayer(props) && isSourceInput(props),
    run: props => handleSourceInput(props.key, props.modal as Extract<FilePickerModalState, { layer: 'source' }>, props.context),
  },
  {
    when: props => isBrowserLayer(props) && isBrowserInput(props),
    run: props => handleBrowserInput(props.key, props.modal as Extract<FilePickerModalState, { layer: 'browser' }>, props.context),
  },
  {
    when: props => isUrlLayer(props) && isUrlInput(props),
    run: props => handleUrlInput(props.input, props.key, props.modal as Extract<FilePickerModalState, { layer: 'url' }>, props.context),
  },
]);

function isSourceLayer({ modal }: ModalInputProps) {
  return (modal as FilePickerModalState).layer === 'source';
}

function isBrowserLayer({ modal }: ModalInputProps) {
  return (modal as FilePickerModalState).layer === 'browser';
}

function isUrlLayer({ modal }: ModalInputProps) {
  return (modal as FilePickerModalState).layer === 'url';
}

function isSourceInput(props: ModalInputProps) {
  return isSubmit(props) || props.key.upArrow || props.key.downArrow;
}

function isBrowserInput(props: ModalInputProps) {
  return isSubmit(props) || props.key.leftArrow || isBackspace(props) || props.key.upArrow || props.key.downArrow;
}

function isUrlInput(props: ModalInputProps) {
  return isSubmit(props) || props.key.leftArrow || isBackspace(props) || isPlainTextInput(props) || (props.key.ctrl && props.input === 'v');
}

function handleSourceInput(
  key: ModalInputProps['key'],
  state: Extract<FilePickerModalState, { layer: 'source' }>,
  context: ModalContext,
) {
  if (key.upArrow) {
    context.updateModal({ ...state, selected: (state.selected - 1 + SOURCE_OPTIONS.length) % SOURCE_OPTIONS.length, error: undefined });
    return;
  }

  if (key.downArrow) {
    context.updateModal({ ...state, selected: (state.selected + 1) % SOURCE_OPTIONS.length, error: undefined });
    return;
  }

  if (key.return) {
    const option = SOURCE_OPTIONS[state.selected];
    if (option?.id === 'computer') context.updateModal(readDirectory(HOME_DIR));
    if (option?.id === 'url') context.updateModal({ id: 'filepicker', layer: 'url', url: '', downloading: false });
  }
}

function handleBrowserInput(
  key: ModalInputProps['key'],
  state: Extract<FilePickerModalState, { layer: 'browser' }>,
  context: ModalContext,
) {
  if (key.return) {
    selectEntry(state, context);
    return;
  }

  if (key.leftArrow || key.backspace || key.delete) {
    goToParent(state, context);
    return;
  }

  if (key.upArrow) {
    moveSelection(state, context, -1);
    return;
  }

  if (key.downArrow) {
    moveSelection(state, context, 1);
  }
}

function handleUrlInput(
  input: string,
  key: ModalInputProps['key'],
  state: Extract<FilePickerModalState, { layer: 'url' }>,
  context: ModalContext,
) {
  if (state.downloading) return;

  if (key.leftArrow) {
    context.updateModal({ id: 'filepicker', layer: 'source', selected: 1 });
    return;
  }

  if (key.return) {
    void downloadUrlMaterial(state, context);
    return;
  }

  if (key.ctrl && input === 'v') {
    const pasted = readClipboardText();
    if (!pasted) {
      context.updateModal({ ...state, error: 'Clipboard paste is unavailable in this terminal.' });
      return;
    }

    context.updateModal({ ...state, url: `${state.url}${pasted.trim()}`, error: undefined });
    return;
  }

  if (key.backspace || key.delete) {
    context.updateModal({ ...state, url: state.url.slice(0, -1), error: undefined });
    return;
  }

  if (!key.ctrl && !key.meta && !key.tab && input) {
    context.updateModal({ ...state, url: state.url + input, error: undefined });
  }
}

function selectEntry(state: Extract<FilePickerModalState, { layer: 'browser' }>, context: ModalContext) {
  const entry = state.entries[state.selected];
  if (!entry) return;

  if (entry.type === 'directory') {
    context.updateModal(readDirectory(entry.path));
    return;
  }

  try {
    fs.accessSync(entry.path, fs.constants.R_OK);
  } catch {
    context.updateModal({ ...state, error: 'OpenStudy does not have permission to read this document.' });
    return;
  }

  context.updateSettings({ material: entry.path });
  context.closeModal();
}

function goToParent(state: Extract<FilePickerModalState, { layer: 'browser' }>, context: ModalContext) {
  if (state.cwd === HOME_DIR) {
    context.updateModal({ id: 'filepicker', layer: 'source', selected: 0 });
    return;
  }

  const parent = path.dirname(state.cwd);
  if (parent === state.cwd || !isInsideHome(parent)) return;

  context.updateModal(readDirectory(parent));
}

function moveSelection(state: Extract<FilePickerModalState, { layer: 'browser' }>, context: ModalContext, direction: -1 | 1) {
  if (state.entries.length === 0) return;

  context.updateModal({ ...state, selected: (state.selected + direction + state.entries.length) % state.entries.length, error: undefined });
}

async function downloadUrlMaterial(state: Extract<FilePickerModalState, { layer: 'url' }>, context: ModalContext) {
  const url = state.url.trim();
  if (!url) {
    context.updateModal({ ...state, error: 'URL is required.' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    context.updateModal({ ...state, error: 'Enter a valid URL.' });
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    context.updateModal({ ...state, error: 'Only HTTP and HTTPS URLs are supported.' });
    return;
  }

  context.updateModal({ ...state, downloading: true, error: undefined });

  try {
    const response = await fetch(parsed);
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);

    const contentType = response.headers.get('content-type') ?? '';
    const filename = getDownloadFilename(parsed, response.headers.get('content-disposition'), contentType);
    if (!isDocumentFile(filename) && !isDocumentContentType(contentType)) {
      throw new Error('That URL does not look like a supported document.');
    }

    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    const target = uniqueDocumentPath(filename);
    const data = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(target, data);
    fs.accessSync(target, fs.constants.R_OK);

    context.updateSettings({ material: target });
    context.closeModal();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.updateModal({ ...state, downloading: false, error: message });
  }
}

function readDirectory(directory: string): FilePickerModalState {
  const cwd = path.resolve(directory);
  if (!isInsideHome(cwd)) {
    return readDirectory(HOME_DIR);
  }

  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true })
      .filter(entry => (
        (entry.isDirectory() && !entry.name.startsWith('.')) ||
        (entry.isFile() && isDocumentFile(entry.name))
      ))
      .map(entry => {
        const entryPath = path.join(cwd, entry.name);
        let mtime: number | undefined;
        try { mtime = fs.statSync(entryPath).mtimeMs; } catch { /* ignore stat errors */ }
        return {
          name: entry.name,
          path: entryPath,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          mtime,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        if (a.mtime !== undefined && b.mtime !== undefined) {
          const mtimeSort = b.mtime - a.mtime;
          if (mtimeSort !== 0) return mtimeSort;
        } else if (a.mtime !== undefined) {
          return -1;
        } else if (b.mtime !== undefined) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });

    return { id: 'filepicker', layer: 'browser', cwd, entries, selected: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { id: 'filepicker', layer: 'browser', cwd, entries: [], selected: 0, error: message };
  }
}

function readClipboardText(): string | null {
  const commands: Array<[string, string[]]> = [
    ['wl-paste', ['--no-newline']],
    ['xclip', ['-selection', 'clipboard', '-o']],
    ['xsel', ['--clipboard', '--output']],
  ];

  for (const [command, args] of commands) {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 1000 });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }

  return null;
}

function getDownloadFilename(url: URL, contentDisposition: string | null, contentType: string): string {
  const dispositionName = contentDisposition?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)?.[1];
  const urlName = path.basename(decodeURIComponent(url.pathname));
  const rawName = sanitizeFilename(dispositionName ?? (urlName || 'document'));
  const extension = path.extname(rawName) || extensionFromContentType(contentType) || '.txt';
  const baseName = path.basename(rawName, path.extname(rawName)) || 'document';

  return `${baseName}${extension}`;
}

function uniqueDocumentPath(filename: string): string {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  let candidate = path.join(DOCUMENTS_DIR, filename);
  let counter = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(DOCUMENTS_DIR, `${baseName}-${counter}${extension}`);
    counter += 1;
  }

  return candidate;
}

function sanitizeFilename(value: string): string {
  return value.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'document';
}

function isDocumentContentType(contentType: string): boolean {
  const type = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return type.startsWith('text/') || [
    'application/csv',
    'application/epub+zip',
    'application/json',
    'application/msword',
    'application/pdf',
    'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/xml',
  ].includes(type);
}

function extensionFromContentType(contentType: string): string | null {
  const type = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const extensions: Record<string, string> = {
    'application/epub+zip': '.epub',
    'application/json': '.json',
    'application/msword': '.doc',
    'application/pdf': '.pdf',
    'application/rtf': '.rtf',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.oasis.opendocument.presentation': '.odp',
    'application/vnd.oasis.opendocument.spreadsheet': '.ods',
    'application/vnd.oasis.opendocument.text': '.odt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/xml': '.xml',
    'text/csv': '.csv',
    'text/markdown': '.md',
    'text/plain': '.txt',
    'text/tab-separated-values': '.tsv',
    'text/xml': '.xml',
    'text/yaml': '.yaml',
  };

  if (extensions[type]) return extensions[type];
  if (type.startsWith('text/')) return '.txt';
  return null;
}

function isDocumentFile(name: string): boolean {
  return DOCUMENT_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function isInsideHome(value: string): boolean {
  const resolved = path.resolve(value);
  return resolved === HOME_DIR || resolved.startsWith(`${HOME_DIR}${path.sep}`);
}

function shortenPath(value: string) {
  const home = os.homedir();
  return value.startsWith(home) ? `~${value.slice(home.length)}` : value;
}

function truncateError(message: string) {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 54 ? `${normalized.slice(0, 53)}…` : normalized;
}
