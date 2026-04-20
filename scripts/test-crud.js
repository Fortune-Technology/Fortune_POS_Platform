#!/usr/bin/env node
/**
 * scripts/test-crud.js — end-to-end CRUD test runner.
 *
 * 1. Checks if backend is running on :5000
 * 2. If not, starts it, waits for readiness (up to 30s)
 * 3. Runs both CRUD test suites
 * 4. If this script started the backend, stops it; if it was already running,
 *    leaves it alone
 *
 * Usage:  node scripts/test-crud.js
 *    or:  npm run test:crud:auto
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BACKEND_URL = process.env.TEST_API_URL || 'http://localhost:5000';

const color = {
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

async function isBackendUp() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(BACKEND_URL + '/', { signal: ctrl.signal }).catch(() => null);
    clearTimeout(t);
    return !!res;
  } catch {
    return false;
  }
}

async function waitForBackend(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isBackendUp()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const alreadyRunning = await isBackendUp();
  let backendProc = null;

  if (!alreadyRunning) {
    console.log(color.cyan('▶ Backend not running — starting it...'));
    const isWin = process.platform === 'win32';
    backendProc = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
      cwd:    path.join(ROOT, 'backend'),
      stdio:  ['ignore', 'pipe', 'pipe'],
      shell:  isWin,
      env:    { ...process.env, NODE_ENV: 'development' },
    });

    // Forward minimal output to show startup progress
    backendProc.stdout.on('data', d => {
      const s = d.toString();
      if (s.match(/listening|running|started|✓|error/i)) process.stdout.write(color.dim('  [backend] ' + s));
    });
    backendProc.stderr.on('data', d => {
      const s = d.toString();
      if (s.match(/error|warn/i) && !s.match(/deprecat|experimental/i)) process.stderr.write(color.dim('  [backend] ' + s));
    });

    console.log(color.cyan('▶ Waiting for backend to be ready...'));
    const ready = await waitForBackend(30000);
    if (!ready) {
      console.error(color.red('✗ Backend failed to start within 30s'));
      if (backendProc && !backendProc.killed) backendProc.kill();
      process.exit(1);
    }
    console.log(color.green('✓ Backend is up'));
  } else {
    console.log(color.dim('✓ Backend already running — using existing process'));
  }

  console.log(color.cyan('\n▶ Running CRUD test suites...\n'));
  const isWin = process.platform === 'win32';
  const testProc = spawn(
    process.execPath,
    ['--test', 'tests/crud.test.mjs', 'tests/catalog-vendors.test.mjs'],
    { cwd: path.join(ROOT, 'backend'), stdio: 'inherit', shell: false },
  );

  testProc.on('exit', (code) => {
    console.log();
    if (code === 0) console.log(color.green('✓ All tests passed'));
    else            console.log(color.red(`✗ Tests failed (exit ${code})`));

    // Cleanup — only stop backend if WE started it
    if (backendProc && !backendProc.killed) {
      console.log(color.dim('▶ Stopping backend (we started it)...'));
      backendProc.kill();
    } else if (alreadyRunning) {
      console.log(color.dim('▶ Leaving backend running (was already up)'));
    }
    process.exit(code || 0);
  });
}

main().catch((e) => {
  console.error(color.red('✗ test-crud runner failed:'), e);
  process.exit(1);
});
