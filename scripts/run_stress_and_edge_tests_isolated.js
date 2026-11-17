#!/usr/bin/env node
/**
 * ============================================================================
 * RUNNER AISLADO DE LA SUITE DE CRASTUR
 * ============================================================================
 * Ejecuta la suite de estrés y la prueba de longitud de mensajes sobre una base
 * de datos TEMPORAL, de modo que nunca se tocan los datos de producción.
 *
 * Uso: npm test
 * ============================================================================
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'crastur-test-'));

console.log(`[Test Aislado] Base de datos temporal: ${TEST_DATA_DIR}`);

const env = {
  ...process.env,
  CRASTUR_DATA_DIR: TEST_DATA_DIR
};

function runScript(script) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(__dirname, script)],
    { cwd: ROOT, stdio: 'inherit', env }
  );
}

const stress = runScript('run_stress_and_edge_tests.ts');
const copy = stress.status === 0 ? runScript('run_copy_budget_tests.ts') : { status: 1 };

// Limpieza de la carpeta temporal (no afecta datos reales)
try {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  console.log('[Test Aislado] Carpeta temporal eliminada.');
} catch (e) {
  console.warn('[Test Aislado] No se pudo eliminar la carpeta temporal:', e?.message || e);
}

const status = stress.status === 0 && copy.status === 0 ? 0 : 1;
process.exit(status);
