const SIMILAR_COLOR_DISTANCE = 85;

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function focusTextColor(color: string, subjectColor: string, focused: boolean): string {
  if (!focused) return color;

  const source = parseHexColor(color);
  const subject = parseHexColor(subjectColor);

  if (!source || !subject) return color;
  if (isNeutralColor(source) || colorDistance(source, subject) <= SIMILAR_COLOR_DISTANCE) return '#000000';

  return color;
}

function parseHexColor(color: string): RgbColor | null {
  const value = color.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function isNeutralColor(color: RgbColor): boolean {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b) <= 18;
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}
