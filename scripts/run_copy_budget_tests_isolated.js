#!/usr/bin/env node
/**
 * Ejecuta la prueba de longitud de mensajes sobre una base temporal.
 * Uso: npm run test:copy
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'crastur-copy-'));

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', path.join(__dirname, 'run_copy_budget_tests.ts')],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CRASTUR_DATA_DIR: TEST_DATA_DIR } }
);

try {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
} catch (e) {
  console.warn('[Copy Test] No se pudo eliminar la carpeta temporal:', e?.message || e);
}

process.exit(result.status === null ? 1 : result.status);
