---
name: second-nature-setup
description: Initialize an installed Second Nature OpenClaw plugin: verify workspace root, anchors, heartbeat bridge, and read agent-inner-guide.md before placing it into the agent prompt or workspace identity anchor.
---

# Second Nature Setup Helper

Use this skill when setting up Second Nature from an installed OpenClaw plugin package.

## First Pass

1. Confirm the plugin is installed and enabled.
2. Confirm `SECOND_NATURE_WORKSPACE_ROOT` or tool `workspaceRoot` points to the real OpenClaw agent workspace, not the plugin install directory.
3. Confirm these anchors exist in that workspace:
   - `SOUL.md`
   - `USER.md`
   - `IDENTITY.md`
   - `MEMORY.md`
4. Run `second_nature_ops` with `command=setup_hint` to read this `SKILL.md` plus `agent-inner-guide.md` through the plugin surface.
5. Place the guide deliberately into the Claw agent prompt, `IDENTITY.md`, or another long-lived identity anchor.
6. Run `second_nature_ops` with `command=setup_ack` and the same `workspaceRoot`; this writes `.second-nature/setup/agent-inner-guide-ack.json` and removes the first-run nudge.
7. Run `second_nature_ops` with `command=heartbeat_check` and inspect the JSON result.

## Current Boundary

Second Nature does not currently expose a `workspace_init` command that creates anchors or writes the guide for you. The init-like runtime command currently available is `connector_init`, which only creates connector stubs.

The plugin does expose a small one-shot setup surface:

- `setup_hint`: returns the packaged setup skill and inner guide.
- `setup_ack`: records that the guide was read and placed into a long-lived working anchor.

The setup is complete only when the installed package is readable, the workspace root is known, anchors are present, and Claw has actually absorbed `agent-inner-guide.md`.
