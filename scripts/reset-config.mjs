#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';

const configFile = path.join(os.homedir(), '.openstudy', 'config.json');

if (fs.existsSync(configFile)) {
  fs.unlinkSync(configFile);
  console.log('Config reset. Run openstudy to set up again.');
} else {
  console.log('No config found — nothing to reset.');
}
