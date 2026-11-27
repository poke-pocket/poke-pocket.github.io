#!/usr/bin/env node
/**
 * Launch POKé POCKET in Developer Debug Mode (`VITE_DEBUG_MODE=1`).
 * Unlocks time-of-day override, weather override, and FPS debug controls automatically.
 *
 * Usage:
 *   npm run dev:debug
 *   node scripts/dev-debug.mjs --port 5173
 */
import { spawn } from 'node:child_process';

const extraArgs = process.argv.slice(2);
const hasPort = extraArgs.some((a) => a === '--port' || a.startsWith('--port='));
const viteArgs = ['vite', ...(hasPort ? [] : ['--port', '5173']), ...extraArgs];

console.log('[POKé POCKET] Starting Vite dev server with Developer Debug Mode ENABLED (VITE_DEBUG_MODE=1)...');
console.log('[POKé POCKET] Tip: You can also toggle Debug Mode anytime via ?debug=1, window.__POKE_POCKET_DEBUG__.enable(), or tapping POWER 10 times.');

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', viteArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_DEBUG_MODE: '1',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
