export interface CliCommandDefinition {
  name: string;
  description: string;
  execute(input?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

const notImplemented = async (command: string) => ({
  ok: false,
  command,
  message: "Command shell registered. Implementation lands in later Wave tasks.",
});

export const cliCommands: CliCommandDefinition[] = [
  {
    name: "status",
    description: "Show aggregated Second Nature status",
    execute: () => notImplemented("status"),
  },
  {
    name: "policy",
    description: "Write or inspect policy state",
    execute: () => notImplemented("policy"),
  },
  {
    name: "credential",
    description: "Inspect or recover credential state",
    execute: () => notImplemented("credential"),
  },
  {
    name: "quiet",
    description: "Inspect Quiet lifecycle state",
    execute: () => notImplemented("quiet"),
  },
  {
    name: "report",
    description: "Show daily report artifacts",
    execute: () => notImplemented("report"),
  },
  {
    name: "session",
    description: "Inspect continuity session details",
    execute: () => notImplemented("session"),
  },
  {
    name: "audit",
    description: "Inspect audit and evidence views",
    execute: () => notImplemented("audit"),
  },
  {
    name: "explain",
    description: "Answer why-question explain requests",
    execute: () => notImplemented("explain"),
  },
];
