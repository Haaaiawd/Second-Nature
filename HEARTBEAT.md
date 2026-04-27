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

- If the result contains `heartbeat: "HEARTBEAT_OK"` or `status: "heartbeat_ok"`, continue normally.
- Treat that result as "no additional action is required from this host-safe surface for this round".

## Next-step semantics

- If the result includes `nextAction: "continue"`, stop and continue the regular heartbeat flow.
- If a future structured heartbeat decision returns a different `nextAction`, follow that explicit action instead of inventing one.

## Boundary

- This file defines the shipping heartbeat bridge entry.
- Do not treat `second-nature-runtime` service startup as a per-heartbeat callback.
