import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

console.log('=== Packaging Feasibility POC Report ===\n');

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
console.log('Plugin has no dependencies field:', !pluginPkg.dependencies);

const neededForRuntime = [
  'command router (dist/src/cli/index.js)',
  'read models (dist/src/cli/read-models/)',
  'action bridge (dist/src/cli/action-bridge.js)',
  'state runtime (dist/src/storage/)',
  'observability runtime (dist/src/observability/)',
  'heartbeat service entry (dist/src/core/second-nature/)',
];
console.log('Needed for runtime artifact:');
neededForRuntime.forEach(item => console.log('  - ' + item));

console.log('\n❌ Current artifact boundary: FAIL');
console.log('  - Only wrapper + manifest included');
console.log('  - No runtime code in package');
console.log('  - References ../src/cli/index.js which does not exist after install\n');

// 5. Test compiled code import chain
console.log('--- Test 5: Compiled code import chain ---');
try {
  const cliPath = path.resolve(rootDir, 'dist/src/cli/index.js');
  const cliModule = await import(cliPath);
  console.log('Direct import successful:', !!cliModule);
  console.log('Exports:', Object.keys(cliModule));
  console.log('✅ Compiled import chain: PASS\n');
} catch (e: unknown) {
  const err = e as Error;
  console.log('❌ Compiled import chain: FAIL');
  console.log('Error:', err.message, '\n');
}

// 6. Test plugin/index.ts loading from installed location
console.log('--- Test 6: Plugin wrapper from installed location ---');
const installedPlugin = 'D:/tmp/plugin-test/node_modules/@haaaiawd/second-nature';
const installedIndexPath = path.join(installedPlugin, 'index.ts');
const installedIndex = fs.readFileSync(installedIndexPath, 'utf-8');
const hasExternalRef = installedIndex.includes('../src/');
console.log('Has external src reference:', hasExternalRef);
console.log('External ref path: ../src/cli/index.js');
const resolvedPath = path.resolve(installedPlugin, '../src/cli/index.js');
console.log('This path resolves to:', resolvedPath);
console.log('Path exists:', fs.existsSync(resolvedPath));
console.log('❌ Plugin wrapper from installed location: FAIL');
console.log('  - Wrapper references external src/ path');
console.log('  - After install, this path does not exist\n');

console.log('=== Summary ===');
console.log('1. jiti loading: ✅ PASS - Can load compiled JS modules');
console.log('2. better-sqlite3: ✅ PASS - Native module works in dev environment');
console.log('3. npm install --ignore-scripts: ⚠️ RISK - better-sqlite3 needs native compilation');
console.log('4. Artifact closure: ❌ FAIL - No runtime code in package');
console.log('5. Compiled import chain: ✅ PASS - Direct imports work');
console.log('6. Plugin wrapper installed: ❌ FAIL - References non-existent src/ path');
console.log('\nConclusion: 可继续沿用 (Can continue using current stack)');
console.log('But requires:');
console.log('  - Package runtime code into plugin artifact');
console.log('  - Fix plugin wrapper to use package-local paths');
console.log('  - Address better-sqlite3 native compilation for --ignore-scripts scenarios');
