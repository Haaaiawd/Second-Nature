# docs/explore

Landing directory for independent `/explore` workflow outputs (per `.windsurf/workflows/explore.md`).

When the `/explore` workflow is invoked outside of `/design-system`, it writes structured exploration reports here using the naming convention:

```
docs/explore/{YYYYMMDD}_{topic_slug}.md
```

Reports produced during active design work should instead be written to:

```
.anws/v{N}/04_SYSTEM_DESIGN/_research/{system-id}-research.md
```

This directory starts empty; files are added by exploration runs.
