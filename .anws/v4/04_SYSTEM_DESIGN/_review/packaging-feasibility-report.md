# Packaging Feasibility POC Report

**Task**: T1.0.1  
**Date**: 2026-03-31  
**Status**: Complete  

---

## Executive Summary

**结论: 可继续沿用 (Can continue using current stack)**

当前技术栈（TypeScript + Node.js + better-sqlite3 + jiti）在开发环境下完全可行，但存在三个需要在后续任务中解决的 packaging 问题。

---

## Test Results

### ✅ Test 1: jiti Loading
- **Status**: PASS
- **Details**: jiti 2.6.1 可以成功加载编译后的 `dist/src/cli/index.js`
- **Exports verified**: `createCommandRouter`, `createCliRuntimeDeps`
- **Risk**: None

### ✅ Test 2: better-sqlite3 Native Module
- **Status**: PASS
- **Details**: better-sqlite3 11.10.0 原生模块在开发环境正常工作
- **Test**: 创建内存数据库、建表、插入、查询全部成功
- **Risk**: 仅在开发环境验证

### ⚠️ Test 3: npm install --ignore-scripts Impact
- **Status**: RISK IDENTIFIED
- **Details**: 
  - better-sqlite3 需要原生编译或预编译二进制
  - 当前 `node_modules/better-sqlite3/prebuilds/` 不存在
  - 使用 `--ignore-scripts` 安装时，可能无法获取预编译二进制
- **Risk**: 如果 OpenClaw 宿主环境使用 `--ignore-scripts`，better-sqlite3 可能无法工作
- **Mitigation**: 后续任务需验证宿主实际安装行为，或考虑替代方案（如 sql.js）

### ❌ Test 4: Artifact Closure Boundary
- **Status**: FAIL
- **Details**:
  - 当前 plugin `files` 只包含 `["index.ts", "openclaw.plugin.json"]`
  - 无 runtime 代码被包含
  - 无 dependencies 声明
  - 需要包含的最小运行时：command router, read models, action bridge, state runtime, observability runtime, heartbeat service entry
- **Risk**: 发布包安装后无法运行任何命令

### ✅ Test 5: Compiled Import Chain
- **Status**: PASS (with workaround)
- **Details**: 编译后的模块可以直接 import，但 Windows 路径需要 `file://` 协议
- **Risk**: Low - 这是测试环境问题，不是 runtime 问题

### ❌ Test 6: Plugin Wrapper from Installed Location
- **Status**: FAIL
- **Details**:
  - 安装的 plugin `index.ts` 引用 `../src/cli/index.js`
  - 该路径在安装后解析到 `node_modules/@haaaiawd/src/cli/index.js`
  - 该路径不存在
- **Risk**: 所有命令退化为 fallback

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| better-sqlite3 原生编译失败 | High | Medium | 验证宿主安装行为；准备 sql.js 备选方案 |
| 发布包无 runtime 代码 | Critical | Certain | T1.1.1-T1.1.2 解决 |
| Wrapper 引用外部路径 | Critical | Certain | T1.2.1 解决 |
| jiti 加载失败 | Low | Low | 已验证可行 |

---

## Conclusion

**可继续沿用当前技术栈**，但必须在后续任务中：

1. **T1.1.1**: 建立 plugin runtime artifact 构建边界
2. **T1.1.2**: 打包 command router 与 CLI runtime 依赖图
3. **T1.2.1**: 重写 plugin wrapper 到包内 runtime 解析路径
4. **T1.2.2**: 将 service surface 纳入 packaged runtime
5. **额外关注**: 验证 better-sqlite3 在宿主环境的原生编译可行性

**不需要的变更**:
- 不需要更换 jiti
- 不需要更换 TypeScript/Node.js 主栈
- 不需要引入 bundler（esbuild/rollup）

---

## Evidence

- jiti 2.6.1 加载测试: ✅ 通过
- better-sqlite3 11.10.0 原生模块测试: ✅ 通过
- npm pack 产物分析: ❌ 仅包含 wrapper + manifest
- 安装后路径验证: ❌ 外部引用不存在
- 编译模块导入: ✅ 通过
