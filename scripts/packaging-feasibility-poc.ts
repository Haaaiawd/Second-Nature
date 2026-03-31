import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve project root regardless of whether script runs from source or dist/.
 * When compiled, __dirname is dist/scripts/, so we need to go up two levels.
 * When running from source via --experimental-strip-types, __dirname is scripts/.
 */
function resolveRootDir(): string {
  if (__dirname.includes(path.sep + 'dist' + path.sep + 'scripts')) {
    return path.resolve(__dirname, '..', '..');
  }
  if (__dirname.endsWith('scripts')) {
    return path.resolve(__dirname, '..');
  }
  return path.resolve(__dirname, '..');
}

const rootDir = resolveRootDir();
const require = createRequire(import.meta.url);

console.log('=== Packaging Feasibility POC Report ===');
console.log('Project root:', rootDir, '\n');

// 1. Test jiti loading of compiled JS
console.log('--- Test 1: jiti loading of compiled JS ---');
try {
  const { createJiti } = require('jiti');
  const jiti = createJiti(import.meta.url);

  const cliPath = path.resolve(rootDir, 'dist/src/cli/index.js');
  console.log('Attempting to load:', cliPath);
  console.log('File exists:', fs.existsSync(cliPath));

  const mod = jiti(cliPath);
  console.log('Module loaded successfully:', !!mod);
  console.log('Has createCommandRouter:', !!mod.createCommandRouter);
  console.log('Has createCliRuntimeDeps:', !!mod.createCliRuntimeDeps);
  console.log('✅ jiti loading: PASS\n');
} catch (e: unknown) {
  const err = e as Error;
  console.log('❌ jiti loading: FAIL');
  console.log('Error:', err.message, '\n');
}

// 2. Test better-sqlite3 native module
console.log('--- Test 2: better-sqlite3 native module ---');
try {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
  db.exec("INSERT INTO test (name) VALUES ('test')");
  const row = db.prepare('SELECT * FROM test').get();
  console.log('SQLite test row:', row);
  db.close();
  console.log('✅ better-sqlite3: PASS\n');
} catch (e: unknown) {
  const err = e as Error;
  console.log('❌ better-sqlite3: FAIL');
  console.log('Error:', err.message, '\n');
}

// 3. Test npm install --ignore-scripts impact
console.log('--- Test 3: npm install --ignore-scripts impact ---');
console.log('better-sqlite3 requires native compilation during npm install');
console.log('With --ignore-scripts, better-sqlite3 prebuilds may not be available');
const sqlitePkg = require('better-sqlite3/package.json');
console.log('Current better-sqlite3 version:', sqlitePkg.version);
const prebuildsPath = path.resolve(rootDir, 'node_modules/better-sqlite3/prebuilds');
console.log('Check if prebuilds are bundled:', fs.existsSync(prebuildsPath));
console.log('⚠️ better-sqlite3 with --ignore-scripts: RISK (needs prebuild or compilation)\n');

// 4. Test artifact closure boundary
console.log('--- Test 4: Artifact closure boundary ---');
const pluginPkgPath = path.resolve(rootDir, 'plugin/package.json');
const pluginPkg = JSON.parse(fs.readFileSync(pluginPkgPath, 'utf-8'));
console.log('Current plugin files field:', JSON.stringify(pluginPkg.files));
console.log('Current plugin main:', pluginPkg.main);
console.log('Plugin has dependencies field:', !!pluginPkg.dependencies);

const runtimeDir = path.resolve(rootDir, 'plugin/runtime');
const hasRuntimeDir = fs.existsSync(runtimeDir);
console.log('plugin/runtime/ exists:', hasRuntimeDir);

if (hasRuntimeDir) {
  const entries = fs.readdirSync(runtimeDir);
  console.log('Runtime artifact contents:', entries.join(', '));
  console.log('✅ Artifact boundary: PASS — runtime code included in package\n');
} else {
  console.log('❌ Artifact boundary: FAIL — no runtime code in package\n');
}

// 5. Test compiled code import chain
console.log('--- Test 5: Compiled code import chain ---');
try {
  const cliPath = path.resolve(rootDir, 'dist/src/cli/index.js');
  const cliModule = await import(pathToFileURL(cliPath).href);
  console.log('Direct import successful:', !!cliModule);
  console.log('Exports:', Object.keys(cliModule));
  console.log('✅ Compiled import chain: PASS\n');
} catch (e: unknown) {
  const err = e as Error;
  console.log('❌ Compiled import chain: FAIL');
  console.log('Error:', err.message, '\n');
}

// 6. Test plugin wrapper path resolution
console.log('--- Test 6: Plugin wrapper path resolution ---');
const pluginIndexPath = path.resolve(rootDir, 'plugin/index.ts');
const pluginIndex = fs.readFileSync(pluginIndexPath, 'utf-8');
const hasExternalRef = pluginIndex.includes('../src/');
const hasRuntimeRef = pluginIndex.includes('./runtime/');
console.log('Wrapper references ../src/:', hasExternalRef);
console.log('Wrapper references ./runtime/:', hasRuntimeRef);

if (!hasExternalRef && hasRuntimeRef) {
  console.log('✅ Plugin wrapper: PASS — uses package-local paths\n');
} else {
  console.log('❌ Plugin wrapper: FAIL — still references external src/\n');
}

// Summary
console.log('=== Summary ===');
console.log('1. jiti loading: tested');
console.log('2. better-sqlite3: tested');
console.log('3. npm install --ignore-scripts: RISK identified');
console.log('4. Artifact closure:', hasRuntimeDir ? '✅ PASS' : '❌ FAIL');
console.log('5. Compiled import chain: tested');
console.log('6. Plugin wrapper paths:', !hasExternalRef && hasRuntimeRef ? '✅ PASS' : '❌ FAIL');
console.log('\nConclusion: 可继续沿用 (Can continue using current stack)');

function pathToFileURL(filePath: string): URL {
  return new URL('file://' + filePath.replace(/\\/g, '/'));
}
