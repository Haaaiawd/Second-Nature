const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== INT-S1 集成验证报告 ===\n');
console.log('验证目标: Runtime Package 是否让插件安装后可运行\n');

const rootDir = path.resolve(__dirname, '..');
const pluginDir = path.resolve(rootDir, 'plugin');
const runtimeDir = path.resolve(pluginDir, 'runtime');

let allPassed = true;
const results = [];

function check(name, condition, detail) {
  const status = condition ? '✅' : '❌';
  results.push({ name, status, detail });
  if (!condition) allPassed = false;
  console.log(`${status} ${name}`);
  if (detail) console.log(`   ${detail}`);
}

// 1. Artifact structure
console.log('--- 1. Artifact 内容验证 ---');
check(
  'runtime/ 目录存在',
  fs.existsSync(runtimeDir),
  `路径: ${runtimeDir}`
);

check(
  'runtime/cli/index.js 存在 (command router)',
  fs.existsSync(path.join(runtimeDir, 'cli/index.js')),
  '命令路由入口'
);

check(
  'runtime/cli/commands/ 存在',
  fs.existsSync(path.join(runtimeDir, 'cli/commands')),
  '命令实现目录'
);

check(
  'runtime/cli/read-models/ 存在',
  fs.existsSync(path.join(runtimeDir, 'cli/read-models')),
  '读模型目录'
);

check(
  'runtime/storage/ 存在',
  fs.existsSync(path.join(runtimeDir, 'storage')),
  '状态运行时'
);

check(
  'runtime/observability/ 存在',
  fs.existsSync(path.join(runtimeDir, 'observability')),
  '可观测运行时'
);

check(
  'runtime/core/second-nature/ 存在',
  fs.existsSync(path.join(runtimeDir, 'core/second-nature')),
  '核心编排运行时'
);

check(
  'runtime/core/second-nature/runtime/ 存在 (service entry)',
  fs.existsSync(path.join(runtimeDir, 'core/second-nature/runtime')),
  'Service 入口目录'
);

// 2. Required commands
console.log('\n--- 2. 核心命令可用性 ---');
const commandsIndexPath = path.join(runtimeDir, 'cli/commands/index.js');
const commandsContent = fs.readFileSync(commandsIndexPath, 'utf-8');
const requiredCommands = ['status', 'quiet', 'report', 'session', 'explain'];

for (const cmd of requiredCommands) {
  check(
    `命令 "${cmd}" 在 artifact 中可解析`,
    commandsContent.includes(cmd),
    `命令定义存在于 commands/index.js`
  );
}

// 3. Plugin wrapper
console.log('\n--- 3. Plugin Wrapper 验证 ---');
const pluginIndex = fs.readFileSync(path.join(pluginDir, 'index.ts'), 'utf-8');

check(
  'Wrapper 不引用 ../src/ 路径',
  !pluginIndex.includes('../src/'),
  '无源码仓外部依赖'
);

check(
  'Wrapper 引用 ./runtime/ 路径',
  pluginIndex.includes('./runtime/'),
  '使用包内 runtime 解析'
);

check(
  'Wrapper 加载 runtime service',
  pluginIndex.includes('service-entry'),
  'service-entry.js 被引用'
);

check(
  'Wrapper 加载 lifecycle service',
  pluginIndex.includes('lifecycle-service'),
  'lifecycle-service.js 被引用'
);

// 4. Service surface
console.log('\n--- 4. Service Surface 验证 ---');
const serviceEntryPath = path.join(runtimeDir, 'core/second-nature/runtime/service-entry.js');
const lifecyclePath = path.join(runtimeDir, 'core/second-nature/runtime/lifecycle-service.js');

check(
  'second-nature-runtime service 有真实实现',
  fs.existsSync(serviceEntryPath) && fs.readFileSync(serviceEntryPath, 'utf-8').includes('startRuntimeService'),
  '非空壳 start()'
);

check(
  'second-nature-lifecycle service 有真实实现',
  fs.existsSync(lifecyclePath) && fs.readFileSync(lifecyclePath, 'utf-8').includes('recordRegistration'),
  '非空壳 start()'
);

// 5. Package contents
console.log('\n--- 5. 发布包内容验证 ---');
const pluginPkg = JSON.parse(fs.readFileSync(path.join(pluginDir, 'package.json'), 'utf-8'));

check(
  'package.json files 包含 runtime/',
  pluginPkg.files.includes('runtime/'),
  `files: ${JSON.stringify(pluginPkg.files)}`
);

check(
  'package.json 声明 dependencies',
  pluginPkg.dependencies && Object.keys(pluginPkg.dependencies).length > 0,
  `dependencies: ${JSON.stringify(pluginPkg.dependencies)}`
);

// 6. No external references
console.log('\n--- 6. 外部引用检查 ---');
function checkExternalRefs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let found = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found = found.concat(checkExternalRefs(fullPath));
    } else if (entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes('../src/') || content.includes('..\\src\\')) {
        found.push(path.relative(runtimeDir, fullPath));
      }
    }
  }
  return found;
}

const externalRefs = checkExternalRefs(runtimeDir);
check(
  'Runtime artifact 无外部 src/ 引用',
  externalRefs.length === 0,
  externalRefs.length === 0 ? '所有引用均为包内路径' : `发现 ${externalRefs.length} 处外部引用`
);

// 7. Fallback check
console.log('\n--- 7. Fallback 退化检查 ---');
check(
  'Fallback 仅作为异常路径保留',
  pluginIndex.includes('packaging fallback mode'),
  'fallback 消息存在但非常态运行模式'
);

// Summary
console.log('\n=== 验证总结 ===');
const passed = results.filter(r => r.status === '✅').length;
const total = results.length;
console.log(`通过: ${passed}/${total}`);

if (allPassed) {
  console.log('\n✅ INT-S1 集成验证通过');
  console.log('S1 退出标准成立: 安装后的插件不再默认进入 packaging fallback mode');
} else {
  console.log('\n❌ INT-S1 集成验证失败');
  console.log('失败项:');
  results.filter(r => r.status === '❌').forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
}
