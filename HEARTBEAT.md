# Second Nature Heartbeat

Use the shipping Second Nature bridge by calling `second_nature_ops` with command `heartbeat_check` once per heartbeat round.

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
- **Shipping host-safe plugin** (`second_nature_ops` on the packaged carrier): expect `status: "runtime_carrier_only"` with `data.bridge.serviceEntryMode: "runtime_carrier_only"`. That means the carrier acknowledged the round — **not** that a full lived-experience decision loop ran on workspace state.
- Treat the carrier-only result as “no additional action is required **from this carrier surface** for this round”; do not infer rhythm health or empty workspace telemetry from it.

## Next-step semantics

- If the result includes `nextAction: "continue_carrier_surface_only"`, continue the regular heartbeat flow without assuming workspace read models were evaluated.
- If a future structured heartbeat decision returns a different `nextAction`, follow that explicit action instead of inventing one.

## Boundary

- This file defines the shipping heartbeat bridge entry.
- Do not treat `second-nature-runtime` service startup as a per-heartbeat callback.
