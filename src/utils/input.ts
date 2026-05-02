export function isTerminalMouseReport(input: string) {
  return /^(?:\[<\d+;\d+;\d+[mM]|\[M.{3})+$/.test(input);
}
