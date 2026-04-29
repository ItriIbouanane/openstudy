import React from 'react';
import { Box, Text } from 'ink';

// Pre-split ASCII art. Each line is sliced at column 21 where "Study" begins.
// "Open" portion → dim gray, "Study" portion → bright white.
// Original art:
//    ___                   ____  _             _
//   / _ \ _ __   ___ _ __ / ___|| |_ _   _  __| |_   _
//  | | | | '_ \ / _ \ '_ \\___ \| __| | | |/ _` | | | |
//  | |_| | |_) |  __/ | | |___) | |_| |_| | (_| | |_| |
//   \___/| .__/ \___|_| |_|____/ \__|\__,_|\__,_|\__, |
//        |_|                                      |___/

// Split point: after the space separating "Open" glyphs from "Study" glyphs
// The natural break is at col 21 (0-indexed) — between the 'n' tail and 'S' cap.

const LINES: [string, string][] = [
  ['   ___                   ', '____  _             _       '],
  ['  / _ \\ _ __   ___ _ __ ', '/ ___|| |_ _   _  __| |_   _ '],
  [' | | | | \'_ \\ / _ \\ \'_ \\\\', '___ \\| __| | | |/ _` | | | |'],
  [' | |_| | |_) |  __/ | | |', '__) | |_| |_| | (_| | |_| |'],
  ['  \\___/| .__/ \\___|_| |_|', '___/ \\__|\\__,_|\\__,_|\\__, |'],
  ['       |_|               ', '                      |___/ '],
];

export const Logo: React.FC = React.memo(() => (
  <Box flexDirection="column">
    {LINES.map(([open, study], i) => (
      <Box key={i} flexDirection="row">
        <Text color="#666666">{open}</Text>
        <Text color="#dddddd" bold>{study}</Text>
      </Box>
    ))}
  </Box>
));
