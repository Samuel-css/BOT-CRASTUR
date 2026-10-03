#!/usr/bin/env node
/**
 * ============================================================================
 * RUNNER AISLADO DE LA SUITE DE ESTRÉS DEL BOT (scripts/run_stress_and_edge_tests)
 * ============================================================================
 * Ejecuta las 200+ pruebas del bot sobre una base de datos TEMPORAL, de modo que
 * la suite NUNCA inserte productos de prueba ni sesiones en la base de datos de
 * producción (`data/crastur.db`) ni ensucie el snapshot maestro.
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

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', path.join(__dirname, 'run_stress_and_edge_tests.ts')],
  { cwd: ROOT, stdio: 'inherit', env }
);

// Limpieza de la carpeta temporal (no afecta datos reales)
try {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  console.log('[Test Aislado] Carpeta temporal eliminada.');
} catch (e) {
  console.warn('[Test Aislado] No se pudo eliminar la carpeta temporal:', e?.message || e);
}

process.exit(result.status === null ? 1 : result.status);
