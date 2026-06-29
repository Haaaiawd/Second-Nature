# Second Nature Heartbeat

Use the shipping Second Nature bridge by calling `second_nature_ops` with command `heartbeat_check` once per heartbeat round.

## OpenClaw workspace root (operator)

For **full read-bridge** behavior (`workspaceRootResolution` → `env` / `tool_args`), set **`SECOND_NATURE_WORKSPACE_ROOT`** on the gateway **or** pass **`workspaceRoot`** on each `second_nature_ops` call to the **same absolute path** as the OpenClaw **agent workspace** (default `~/.openclaw/workspace`, or `agents.defaults.workspace` in `~/.openclaw/openclaw.json`). That is where `workspace/SOUL.md`, `HEARTBEAT.md`, and Second Nature `data/` should live together. **Sandbox** or **per-agent** layouts: use the **actual** directory where the agent’s files and DB are mounted. See `.anws/v5/05_TASKS.md` T1.1.4 **运维约定 (OpenClaw 宿主)**.

## Tool call

```json
{
  "command": "heartbeat_check",
  "args": {
    "timestamp": "<ISO-8601 timestamp>",
    "sessionContext": "<optional short session summary>",
    "heartbeatChecklist": "HEARTBEAT.md"
  }
}
```

## Success semantics

- **Workspace CLI / full runtime** (read models wired): if the result contains `status: "heartbeat_ok"` (or another explicit lived-experience outcome from the decision loop), treat it per that surface’s contract.
- **OpenClaw plugin + known workspace root** (`SECOND_NATURE_WORKSPACE_ROOT` or tool `workspaceRoot` resolving to `env` / `tool_args`, state DB openable): `heartbeat_check`, `quiet`, `status`, `explain`, `fallback`, `report`, `session`, and `credential` **show** use the **same read path as the workspace CLI** (lazy-loaded packaged runtime). Results match CLI-shaped payloads or return an explicit error — not carrier placeholders.
- **Shipping host-safe plugin** (`second_nature_ops` on the packaged carrier): when the workspace root is **unknown**, expect `status: "runtime_carrier_only"` with `data.bridge.serviceEntryMode: "runtime_carrier_only"`. That means the carrier acknowledged the round — **not** that a full lived-experience decision loop ran on workspace state.
- Treat the carrier-only result as “no additional action is required **from this carrier surface** for this round”; do not infer rhythm health or empty workspace telemetry from it.

## Next-step semantics

- If the result includes `nextAction: "continue_carrier_surface_only"`, continue the regular heartbeat flow without assuming workspace read models were evaluated.
- If a future structured heartbeat decision returns a different `nextAction`, follow that explicit action instead of inventing one.

## Boundary

- This file defines the shipping heartbeat bridge entry.
- Do not treat `second-nature-runtime` service startup as a per-heartbeat callback.
- If heartbeat or Quiet notices a useful platform action that is not registered yet, it may call `second_nature_ops` with `command=connector_behavior_add`. That records a manifest capability only; it does not grant execution trust.

## Agent habit

Heartbeat only tells Claw how to touch the bridge. For the softer habit of using Second Nature in conversation, read `docs/claw-second-nature-inner-guide.md`: pause, look back at traces, and do not turn carrier acknowledgement into invented memory.

When you discover a repeated action, name it plainly, such as `github:issue.search` or `agent-world:profile.inspect`, and leave a short reason in `description` or concrete `sourceRefs`. If you have seen it more than once, include `observedCount`. Good behavior evolution feels like leaving a note for your future self, not forcing the system to pretend it can already do more.
