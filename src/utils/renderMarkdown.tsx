import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';
import Markdown from 'marked-react';

const DEFAULT_COLORS = {
  text: '#eeeeee',
  muted: '#808080',
  accent: '#fab283',
  code: '#f4c7a1',
  quote: '#b8b8b8',
  rule: '#444444',
};

export interface RenderMarkdownOptions {
  colors?: Partial<typeof DEFAULT_COLORS>;
}

type RenderColors = typeof DEFAULT_COLORS;
type RendererContext = { elementId: string };
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export function renderMarkdown(markdown: string, options: RenderMarkdownOptions = {}) {
  const colors = { ...DEFAULT_COLORS, ...options.colors };

  return (
    <Box flexDirection="column">
      <Markdown gfm renderer={createInkMarkdownRenderer(colors)} value={markdown.trim()} />
    </Box>
  );
}

export default renderMarkdown;

function createInkMarkdownRenderer(colors: RenderColors) {
  return {
    heading(this: RendererContext, children: ReactNode, level: HeadingLevel) {
      return (
        <Box key={this.elementId} marginTop={level <= 2 ? 1 : 0}>
          <Text color={colors.accent} bold>
            {level <= 2 ? null : '# '}
            {children}
          </Text>
        </Box>
      );
    },

    paragraph(this: RendererContext, children: ReactNode) {
      return (
        <Text key={this.elementId} color={colors.text}>
          {children}
        </Text>
      );
    },

    blockquote(this: RendererContext, children: ReactNode) {
      return (
        <Box key={this.elementId} flexDirection="row">
          <Text color={colors.accent}>| </Text>
          <Box flexDirection="column" flexShrink={1}>
            {children}
          </Box>
        </Box>
      );
    },

    list(this: RendererContext, children: ReactNode, ordered: boolean, start?: number) {
      return (
        <Box key={this.elementId} flexDirection="column">
          {React.Children.map(children, (child, index) => (
            <Box>
              <Text color={colors.accent}>{ordered ? `${(start ?? 1) + index}.` : '-'}</Text>
              <Text> </Text>
              <Box flexDirection="column" flexShrink={1}>
                {child}
              </Box>
            </Box>
          ))}
        </Box>
      );
    },

    listItem(this: RendererContext, children: ReactNode[]) {
      return (
        <Box key={this.elementId} flexDirection="column" flexShrink={1}>
          {children}
        </Box>
      );
    },

    checkbox(this: RendererContext, checked: boolean) {
      return (
        <Text key={this.elementId} color={colors.accent}>
          {checked ? '[x] ' : '[ ] '}
        </Text>
      );
    },

    code(this: RendererContext, code: ReactNode, lang?: string) {
      const lines = String(code).split('\n');

      return (
        <Box key={this.elementId} flexDirection="column" marginTop={1} marginBottom={1} paddingLeft={1}>
          {lang ? <Text color={colors.muted}>{lang}</Text> : null}
          {(lines.length > 0 ? lines : ['']).map((line, index) => (
            <Text key={`${this.elementId}:line:${index}`} color={colors.code}>
              {line || ' '}
            </Text>
          ))}
        </Box>
      );
    },

    codespan(this: RendererContext, code: ReactNode) {
      return (
        <Text key={this.elementId} color={colors.code}>
          {code}
        </Text>
      );
    },

    strong(this: RendererContext, children: ReactNode) {
      return (
        <Text key={this.elementId} bold>
          {children}
        </Text>
      );
    },

    em(this: RendererContext, children: ReactNode) {
      return (
        <Text key={this.elementId} italic>
          {children}
        </Text>
      );
    },

    del(this: RendererContext, children: ReactNode) {
      return (
        <Text key={this.elementId} dimColor>
          {children}
        </Text>
      );
    },

    link(this: RendererContext, href: string, text: ReactNode) {
      return (
        <Text key={this.elementId}>
          <Text color={colors.accent} underline>
            {text}
          </Text>
          <Text color={colors.muted}> ({href})</Text>
        </Text>
      );
    },

    image(this: RendererContext, src: string, alt: string) {
      return (
        <Text key={this.elementId}>
          <Text color={colors.accent}>{alt || 'image'}</Text>
          <Text color={colors.muted}> ({src})</Text>
        </Text>
      );
    },

    hr(this: RendererContext) {
      return (
        <Text key={this.elementId} color={colors.rule}>
          ----------------
        </Text>
      );
    },

    br(this: RendererContext) {
      return (
        <Text key={this.elementId}>
          {'\n'}
        </Text>
      );
    },

    table(this: RendererContext, children: ReactNode[]) {
      return (
        <Box key={this.elementId} flexDirection="column" marginTop={1} marginBottom={1}>
          {children}
        </Box>
      );
    },

    tableHeader(this: RendererContext, children: ReactNode) {
      return (
        <Box key={this.elementId} flexDirection="column">
          {children}
        </Box>
      );
    },

    tableBody(this: RendererContext, children: ReactNode[]) {
      return (
        <Box key={this.elementId} flexDirection="column">
          {children}
        </Box>
      );
    },

    tableRow(this: RendererContext, children: ReactNode[]) {
      return (
        <Text key={this.elementId}>
          {children}
        </Text>
      );
    },

    tableCell(this: RendererContext, children: ReactNode[], flags: { header?: boolean }) {
      return (
        <Text key={this.elementId} bold={flags.header}>
          {children}
          <Text color={colors.muted}>  </Text>
        </Text>
      );
    },

    text(this: RendererContext, text: ReactNode) {
      return (
        <Text key={this.elementId}>
          {text}
        </Text>
      );
    },

    html(this: RendererContext, html: ReactNode) {
      return (
        <Text key={this.elementId} color={colors.muted}>
          {html}
        </Text>
      );
    },
  };
}
