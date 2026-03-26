# Operator Walkthrough (T5.4.1)

## Scope

This walkthrough is the operator demo path for `T5.4.1` only:

1. plugin load and packaging checks
2. configuration write (`policy set`)
3. recovery flow (`credential verify` with requiredUserInput)
4. status/report/quiet/session state query
5. explain query

It intentionally does not include INT-S4 milestone content.

## Prerequisites

- Repository dependencies installed
- Build artifacts generated (`pnpm build`)
- Local OpenClaw runtime available for manual smoke execution

## Step A: Plugin Packaging + Load Smoke

### A1. Local path install smoke

Run:

```bash
node dist/scripts/plugin-smoke-check.js local-path
```

Expect:

- `ok: true`
- `installSpec` starts with `file:`
- `gatewayRestartRequired: true`
- all `checks` are `true`

### A2. ClawHub path and npm fallback declaration

Run:

```bash
node dist/scripts/plugin-smoke-check.js clawhub
node dist/scripts/plugin-smoke-check.js npm
```

Expect:

- clawhub fallback order: `["clawhub", "npm"]`
- npm fallback order: `["npm", "file"]`

### A3. OpenClaw manual command sequence

```bash
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins enable second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins list
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins info second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins doctor
```

Expected result:

- host discovers plugin id `second-nature`
- command/tool/service surface is available after restart

## Step B: CLI Configuration + Recovery

Use integration harness behavior from `tests/integration/cli/cli-ops-surface.test.ts`:

1. invoke `policy` with `action=set` but missing fields -> returns `requiredUserInput`
2. invoke `policy` with complete payload -> writes canonical state policy record
3. invoke `credential verify` without answer -> returns `requiredUserInput`
4. invoke `credential verify` with answer -> moves pending verification to active

## Step C: Status Query + Explain

Using seeded runtime data:

1. `status` returns aggregated runtime/rhythm/quiet/credential blocks
2. `report` returns daily summary/highlights
3. `session` missing id returns required input, provided id returns structured session detail
4. `explain decision:<id>` returns structured conclusion/keyFactors/evidenceRefs
5. `explain soul:<asset>` returns soul-change explain payload

## Verification Commands

```bash
pnpm typecheck
pnpm test
```

## Evidence Mapping

- `tests/integration/cli/cli-ops-surface.test.ts`: configuration/recovery/status/explain
- `tests/integration/cli/plugin-packaging-walkthrough.test.ts`: packaging/load/fallback lifecycle checks
- `scripts/plugin-smoke-check.ts`: local/clawhub/npm smoke paths

## Manual Validation Record (T5.3.1)

### Captured in this workspace

- Local smoke output captured by running:
  - `node dist/scripts/plugin-smoke-check.js local-path`
  - `node dist/scripts/plugin-smoke-check.js clawhub`
  - `node dist/scripts/plugin-smoke-check.js npm`
- Observed results:
  - local-path: `ok=true`, `pluginPackageExists=true`, `manifestExists=true`, `entryExists=true`
  - clawhub: fallback order is `clawhub -> npm`
  - npm: fallback order is `npm -> file`

### Host-level manual proof (completed with QClaw OpenClaw CLI)

Executed with host runtime:

```bash
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins install file:./plugin
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins enable second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins list
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins info second-nature
node "D:\QClaw\resources\openclaw\node_modules\openclaw\openclaw.mjs" --profile qclaw-plugin-test plugins doctor
```

Observed host results:

- `install`: success (`Installed plugin: second-nature`)
- `enable`: success (`Enabled plugin "second-nature"`)
- `list`: `second-nature` status is `loaded`
- `info second-nature`: status `loaded`; surfaces include tool `second_nature_ops`, CLI command `second-nature`, services `second-nature-runtime` and `second-nature-lifecycle`
- `doctor`: `No plugin issues detected.`
