export function isTerminalMouseReport(input: string) {
  return /^(?:\[<\d+;\d+;\d+[mM]|\[M.{3})+$/.test(input);
}

/**
 * Returns -1 for scroll-up, 1 for scroll-down, 0 for non-scroll mouse reports.
 * SGR extended mouse protocol encodes wheel-up as button 64 and wheel-down as 65.
 */
export function parseMouseWheelScroll(input: string): -1 | 0 | 1 {
  const match = /^\[<(\d+);\d+;\d+M$/.exec(input);
  if (!match) return 0;

  const button = Number.parseInt(match[1] ?? '', 10);
  if (button === 64) return -1;
  if (button === 65) return 1;
  return 0;
}
