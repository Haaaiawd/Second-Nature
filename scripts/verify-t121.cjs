const fs = require('fs');
const path = require('path');

console.log('=== T1.2.1 验收验证 ===\n');

const pluginIndex = fs.readFileSync('plugin/index.ts', 'utf-8');
const hasExternalSrcRef = pluginIndex.includes('../src/');
console.log('1. No external src/ reference in plugin/index.ts:', !hasExternalSrcRef ? '✅' : '❌');

const hasRuntimeRef = pluginIndex.includes('./runtime/');
console.log('2. References package-local ./runtime/:', hasRuntimeRef ? '✅' : '❌');

const runtimePath = path.resolve('plugin/runtime/cli/index.js');
console.log('3. Runtime path exists:', fs.existsSync(runtimePath) ? '✅' : '❌');

const hasFallbackMessage = pluginIndex.includes('packaging fallback mode');
console.log('4. Fallback retained for exceptional cases:', hasFallbackMessage ? '✅' : '❌');

console.log('\n=== 验证结论 ===');
const allPassed = !hasExternalSrcRef && hasRuntimeRef && fs.existsSync(runtimePath);
console.log('T1.2.1 验收标准:', allPassed ? '✅ 全部通过' : '❌ 未通过');
